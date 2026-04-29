/**
 * reports.model.ts
 * Report model building logic extracted from reports.page.ts
 */

import { unifiedDsl } from '../../../../utils/unified-dsl';
import type { Thresholds } from '../../../connect-test-protocol/helpers/thresholds';
import { getConnectTestCQRS } from '../../cqrs/singleton';
import { getDataCQRS } from '../../../shared/data-bridge';
import { ScenariosApiHelper } from '../../../shared/scenarios-api.helper';
import { fetchWithAuth } from '../../../../utils/fetch.utils';
import type { ReportModel, ReportStep } from './types';
import { toSummary, stepIsRemark } from './utils';

const loadFirstCqrs = async (tableName: string, filters: Record<string, any>): Promise<any> => {
  const cqrs = getDataCQRS();
  const p = new URLSearchParams({ filters: JSON.stringify(filters), skip: '0', limit: '1' });
  await cqrs.dispatch({ type: 'LoadRows', tableName, params: p } as any);
  const st = cqrs.getState() as any;
  const rows = Array.isArray(st?.rows?.[tableName]) ? st.rows[tableName] : [];
  return rows[0] || null;
};

export async function buildReportModel(row: any): Promise<ReportModel> {
  let results: any = {};
  try { results = row?.results ? JSON.parse(row.results) : {}; } catch { /* silent */ }
  const steps: ReportStep[] = Array.isArray(results?.steps) ? results.steps : [];
  
  // Enrich steps with recorded param/unit values saved during protocol run
  await enrichStepsWithValues(steps, row);
  
  // Enrich steps with thresholds (MIN/MAX/UNIT) loaded from scenario definition
  await enrichStepsWithThresholds(steps, results);
  
  const summary = toSummary(steps);
  const scenarioName = results?.scenarioName || '';
  const testKind = results?.testKind || '';
  
  // Fetch device, customer, workshop
  const { deviceRow, customerRow, workshopRow, typeRow } = await fetchRelatedEntities(row);
  
  // Fetch session user
  const sessionUser = await fetchSessionUser();
  
  const operator = (row?.operator_username || row?.operator || row?.user || results?.operator_username || results?.operator || results?.user || '').toString();
  const operatorRole = (row?.operator_role || results?.operator_role || '').toString();
  
  return {
    id: String(row?.id || ''),
    title: row?.title,
    type: row?.type,
    status: row?.status,
    scheduled_date: row?.scheduled_date,
    completed_date: row?.completed_date,
    scenarioName,
    testKind,
    steps,
    summary,
    operator,
    operatorRole,
    device: deviceRow,
    customer: customerRow,
    user: sessionUser?.user || null,
    deviceTypeName: (typeRow?.name || deviceRow?.type || '') as string,
    deviceKindCode: await resolveDeviceKindCode(typeRow, deviceRow),
    workshop: workshopRow,
  } as ReportModel;
}

async function enrichStepsWithValues(steps: ReportStep[], row: any): Promise<void> {
  try {
    const pid = String(row?.id || '').trim();
    if (!pid) return;
    
    // Use shared DSL data service for units data
    const { dslDataService } = await import('../../../../components/dsl');
    const dslData = await dslDataService.loadAll();
    
    // NOTE: dsl_param_unit_value table removed in migration c40
    // Measurement values are now stored in protocol.results JSON only
    const vals: any[] = [];
    const unitMap: Record<string, string> = {};
    dslData.units.forEach(u => { if (u.id && (u.name || u.code)) unitMap[u.id] = u.name || u.code; });
    
    // Build goal -> [values]
    const byGoal: Record<string, Array<{ unit_id: string; value: string }>> = {};
    (vals || []).forEach((v: any) => {
      const g = String(v?.goal || '').trim();
      if (!g) return;
      const arr = byGoal[g] || (byGoal[g] = []);
      arr.push({ unit_id: String(v?.unit_id || ''), value: String(v?.value || '') });
    });
    
    // Apply first value to matching step by name
    steps.forEach((s: any) => {
      const name = String(s?.name || '').trim();
      const list = byGoal[name];
      if (Array.isArray(list) && list.length) {
        const first = list[0];
        s.unit = unitMap[first.unit_id] || '';
        s.value = first.value;
      }
    });
  } catch { /* silent */ }
}

async function enrichStepsWithThresholds(steps: ReportStep[], results: any): Promise<void> {
  try {
    const goalNames: string[] = steps.map((s: any) => String(s?.name || '').trim()).filter(Boolean);
    let thresholds: Thresholds = {};
    
    const mod = await import('../../../connect-test-protocol/helpers/thresholds');
    const sid0 = String(results?.scenarioId || '').trim();
    
    const loadById = async (sid: string): Promise<Thresholds> => {
      try {
        return await mod.loadScenarioThresholdsFromDb(sid);
      } catch (e) {
        unifiedDsl.log('THRESHOLD_ERROR', sid, { error: (e as Error)?.message });
        return {};
      }
    };
    
    // Try by scenario ID
    if (sid0) {
      thresholds = await loadById(sid0);
    }
    
    // Try by scenario name
    if (!thresholds || Object.keys(thresholds).length === 0) {
      const sname = String(results?.scenarioName || '').trim();
      if (sname) {
        thresholds = await loadThresholdsByName(sname, loadById);
      }
    }
    
    // Fallback: try best-match scenario by GOAL names
    if (!thresholds || Object.keys(thresholds).length === 0) {
      thresholds = await loadThresholdsByGoalNames(goalNames, loadById);
    }
    
    // Apply thresholds to steps
    if (thresholds && Object.keys(thresholds).length) {
      steps.forEach((s: any) => {
        if (stepIsRemark(s)) return;
        const g = String(s?.name || '').trim();
        const bucket = thresholds[g];
        if (bucket && typeof bucket === 'object') {
          const keys = Object.keys(bucket);
          if (keys.length) {
            const thr = bucket[keys[0]];
            if (thr) {
              if (s.min === undefined && thr.min !== undefined) s.min = thr.min;
              if (s.max === undefined && thr.max !== undefined) s.max = thr.max;
              if (!s.unit && thr.unit) s.unit = thr.unit;
            }
          }
        }
      });
    }
  } catch { /* silent */ }
}

async function loadThresholdsByName(
  sname: string, 
  loadById: (sid: string) => Promise<Thresholds>
): Promise<Thresholds> {
  try {
    const bus = getConnectTestCQRS() as any;
    if (bus?.dispatch) {
      await bus.dispatch({ type: 'LoadTestScenarios', filters: { title: sname } });
      const st = bus.readModel?.getState?.() || bus.getState?.();
      const row = Array.isArray(st?.testScenarios) ? st.testScenarios[0] : null;
      if (row?.id) return loadById(String(row.id));
    } else {
      const rows = await ScenariosApiHelper.listScenarioRows(sname);
      const lc = String(sname || '').trim().toLowerCase();
      const row = rows.find((r: any) => String(r?.title || r?.name || '').toLowerCase() === lc)
        || rows.find((r: any) => String(r?.title || r?.name || '').toLowerCase().startsWith(lc))
        || rows.find((r: any) => String(r?.title || r?.name || '').toLowerCase().includes(lc));
      if (row?.id) return loadById(String(row.id));
    }
  } catch { /* silent */ }
  return {};
}

async function loadThresholdsByGoalNames(
  goalNames: string[], 
  loadById: (sid: string) => Promise<Thresholds>
): Promise<Thresholds> {
  try {
    let rows: any[] = [];
    const bus = getConnectTestCQRS() as any;
    if (bus?.dispatch) {
      await bus.dispatch({ type: 'LoadTestScenarios' });
      const st = bus.readModel?.getState?.() || bus.getState?.();
      rows = Array.isArray(st?.testScenarios) ? st.testScenarios : [];
    } else {
      rows = await ScenariosApiHelper.listAllScenarioRows();
    }
    
    let bestId = '';
    let bestScore = 0;
    for (const r of rows) {
      let content: any = null;
      try {
        if (r.content && typeof r.content === 'string') content = JSON.parse(r.content);
        else if (r.content && typeof r.content === 'object') content = r.content;
        else content = null;
      } catch { content = null; }
      try {
        if (r.goals) {
          if (Array.isArray(r.goals)) {
            content = { ...(content || {}), goals: r.goals };
          } else {
            const goalsObj = typeof r.goals === 'string' ? JSON.parse(r.goals) : r.goals;
            if (goalsObj && typeof goalsObj === 'object' && Array.isArray(goalsObj.goals)) {
              content = { ...(content || {}), goals: goalsObj.goals };
            }
          }
        }
      } catch { /* silent */ }
      const names = Array.isArray(content?.goals) ? content.goals.map((g: any) => String(g?.name || '').trim()).filter(Boolean) : [];
      if (!names.length) continue;
      const match = goalNames.filter((gn: string) => names.includes(gn)).length;
      if (match > bestScore) { bestScore = match; bestId = String(r.id || ''); }
    }
    if (bestId) return loadById(bestId);
  } catch { /* silent */ }
  return {};
}

async function fetchRelatedEntities(row: any): Promise<{
  deviceRow: any;
  customerRow: any;
  workshopRow: any;
  typeRow: any;
}> {
  let deviceRow: any = null;
  let customerRow: any = null;
  let workshopRow: any = null;
  let typeRow: any = null;
  
  try {
    const did = (row?.device_id || '').toString();
    if (did) {
      deviceRow = await loadFirstCqrs('devices', { id: did });
      
      const tcode = String(deviceRow?.type || '').trim();
      if (tcode) {
        typeRow = await fetchTypeByCode(tcode) || await fetchTypeByName(tcode);
      }
      
      const cid = String(deviceRow?.customer_id || '');
      if (cid) {
        customerRow = await fetchCustomerById(cid);
      }
    }
    
    // Fallback: protocol row may directly carry customer_id
    if (!customerRow) {
      const pcid = String(row?.customer_id || '').trim();
      if (pcid) {
        customerRow = await fetchCustomerById(pcid);
      }
    }
    
    const wcode = String(row?.workshop_code || '').trim();
    if (wcode) {
      workshopRow = await fetchWorkshopByCode(wcode);
    }
    
    // Fallback: if workshop not found, mirror customer into workshop section
    if (!workshopRow && customerRow) workshopRow = customerRow;
  } catch { /* silent */ }
  
  return { deviceRow, customerRow, workshopRow, typeRow };
}

async function fetchTypeByCode(code: string): Promise<any> {
  try {
    return await loadFirstCqrs('type_of_device', { code });
  } catch { return null; }
}

async function fetchTypeByName(name: string): Promise<any> {
  try {
    return await loadFirstCqrs('type_of_device', { name });
  } catch { return null; }
}

async function fetchCustomerById(id: string): Promise<any> {
  try {
    return await loadFirstCqrs('customers', { id });
  } catch { return null; }
}

async function fetchWorkshopByCode(code: string): Promise<any> {
  try {
    return await loadFirstCqrs('workshops', { code });
  } catch { return null; }
}

async function fetchSessionUser(): Promise<any> {
  for (const url of ['/api/v3/auth/session']) {
    try {
      const sr = await fetchWithAuth(url);
      if (sr.ok) { 
        const sessionUser = await sr.json(); 
        if (sessionUser?.user) return sessionUser; 
      }
    } catch { /* silent */ }
  }
  return null;
}

async function resolveDeviceKindCode(typeRow: any, deviceRow: any): Promise<string> {
  const kcode = String(typeRow?.kind_code || '').trim();
  if (kcode) {
    try {
      const krow = await loadFirstCqrs('kind_of_device', { code: kcode });
      return String(krow?.name || kcode);
    } catch { return kcode; }
  }
  return String((deviceRow as any)?.kind_of_device || '').trim();
}
