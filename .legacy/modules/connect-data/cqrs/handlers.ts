import { MAX_PAGE_SIZE } from '../../../config/api.config';
import { stateService } from '../../../services/state.service';
// frontend/src/modules/connect-data/cqrs/handlers.ts
import type { HandlerDefinitions } from '../../../core/cqrs/module-factory';
import { ConnectDataCommand, ConnectDataEvent, ColumnDef, RowData } from './types';
import { fetchRowsWithFallback, requestWithFallback } from '../../shared/generic-grid/api';
import { fetchWithAuth } from '../../../utils/fetch.utils';

export const connectDataHandlers: HandlerDefinitions<ConnectDataCommand, ConnectDataEvent> = {
  'SetDataSection': async (cmd, emit) => {
    emit({ type: 'DataSectionSet', payload: { section: (cmd as any).section } });
  },

  'SetDataAction': async (cmd, emit) => {
    emit({ type: 'DataActionSet', payload: { action: (cmd as any).action } });
  },

  // Schema operations
  'LoadSchema': async (cmd, emit) => {
    try {
      let columns: ColumnDef[] | null = null;
      try {
        const res = await fetchWithAuth(`/api/v3/schema/${(cmd as any).tableName}`);
        if (res.ok) {
          const js = await res.json();
          const src = js?.data ?? js;
          if (Array.isArray(src?.columns)) {
            columns = src.columns as ColumnDef[];
          } else if (src?.fields && typeof src.fields === 'object') {
            columns = Object.entries(src.fields).map(([key, meta]: [string, any]) => ({
              key,
              label: String(meta?.label || key),
              type: String(meta?.type || 'text'),
              options: Array.isArray(meta?.options) ? meta.options.map((option: any) => String(option)) : undefined,
              editable: key !== 'id',
            }));
          }
        }
      } catch {
        // Non-blocking: schema fallback below emits empty columns.
      }

      emit({
        type: 'SchemaLoaded',
        payload: { tableName: (cmd as any).tableName, columns: columns || [] }
      });
    } catch {
      emit({
        type: 'SchemaLoaded',
        payload: { tableName: (cmd as any).tableName, columns: [] }
      });
    }
  },

  'RefreshSchema': async (_cmd, emit) => {
    try {
      await fetchWithAuth('/api/v3/schema/refresh', { method: 'POST' });
      // v3 only — v1 fallback removed
      // Clear cache
      stateService.removeItem('connect-data:schema:tables');
      stateService.removeItem('connect-data:schema:tables:ts');

      emit({ type: 'SchemaRefreshed', payload: { success: true } });
    } catch {
      emit({ type: 'SchemaRefreshed', payload: { success: false } });
    }
  },

  // Data operations
  'LoadRows': async (cmd, emit) => {
    try {
      const rowsEndpointBaseRef = { current: null };
      const rows = await fetchRowsWithFallback((cmd as any).tableName, (cmd as any).params, rowsEndpointBaseRef);
      emit({
        type: 'RowsLoaded',
        payload: { tableName: (cmd as any).tableName, rows: rows || [] }
      });
    } catch {
      emit({
        type: 'RowsLoaded',
        payload: { tableName: (cmd as any).tableName, rows: [] }
      });
    }
  },

  // Options loading for dropdowns
  'LoadOptions': async (cmd, emit) => {
    try {
      const options: Record<string, string[]> = {};
      const section = (cmd as any).section;

      if (section === 'devices') {
        // Load customers and device types - v3 primary, v1 fallback
        try {
          const resC = await fetchWithAuth(`/api/v3/data/customers?skip=0&limit=${MAX_PAGE_SIZE}`);
          // v3 only — v1 fallback removed
          if (resC.ok) {
            const jsC = await resC.json();
            const rowsC = Array.isArray(jsC?.data) ? jsC.data : (Array.isArray(jsC?.rows) ? jsC.rows : (Array.isArray(jsC) ? jsC : []));
            options.customers = rowsC.map((r: any) => String(r?.name || r?.customer || '')).filter(Boolean);
          }
        } catch {
          // Optional options source; skip customers when request fails.
        }

        try {
          // type_of_device uses v1 only (no v3 endpoint yet)
          const resT = await fetchWithAuth(`/api/v3/data/type_of_device?skip=0&limit=${MAX_PAGE_SIZE}`);
          if (resT.ok) {
            const jsT = await resT.json();
            const rowsT = Array.isArray(jsT?.data) ? jsT.data : (Array.isArray(jsT?.rows) ? jsT.rows : (Array.isArray(jsT) ? jsT : []));
            options.deviceTypes = rowsT.map((r: any) => String(r?.name || r?.type || '')).filter(Boolean);
          }
        } catch {
          // Optional options source; skip device types when request fails.
        }
      }

      if (section === 'dsl-object-functions') {
        try {
          // Use shared DSL data service instead of direct fetch calls
          const { dslDataService } = await import('../../../components/dsl');
          const data = await dslDataService.loadAll();

          options.objects = data.objects.map(o => o.name).filter(Boolean);
          options.functions = data.functions.map(f => f.name).filter(Boolean);
        } catch {
          // Optional options source; leave object/function options empty on failure.
        }
      }

      emit({
        type: 'OptionsLoaded',
        payload: { section, options }
      });
    } catch {
      emit({
        type: 'OptionsLoaded',
        payload: { section: (cmd as any).section, options: {} }
      });
    }
  },

  // CRUD operations
  'SaveRow': async (cmd, emit) => {
    try {
      const rowsEndpointBaseRef = { current: null };
      const res = await requestWithFallback('PATCH', (cmd as any).tableName, rowsEndpointBaseRef, (cmd as any).rowId, (cmd as any).data);
      if (res && res.ok) {
        emit({
          type: 'RowSaved',
          payload: { tableName: (cmd as any).tableName, rowId: (cmd as any).rowId, data: (cmd as any).data }
        });
      }
    } catch {
      // Silent fail - could log error in future
    }
  },

  'DeleteRow': async (cmd, emit) => {
    try {
      const rowsEndpointBaseRef = { current: null };
      const res = await requestWithFallback('DELETE', (cmd as any).tableName, rowsEndpointBaseRef, (cmd as any).rowId);
      if (res && res.ok) {
        emit({
          type: 'RowDeleted',
          payload: { tableName: (cmd as any).tableName, rowId: (cmd as any).rowId }
        });
      }
    } catch {
      // Silent fail - could log error in future
    }
  },

  'CreateRow': async (cmd, emit) => {
    try {
      const rowsEndpointBaseRef = { current: null };
      const res = await requestWithFallback('POST', (cmd as any).tableName, rowsEndpointBaseRef, undefined, (cmd as any).data);
      if (res && res.ok) {
        const json = await res.json().catch(() => ({}));
        const row: RowData = json.row || { id: `temp-${Date.now()}`, ...(cmd as any).data };

        emit({
          type: 'RowCreated',
          payload: { tableName: (cmd as any).tableName, row }
        });
      }
    } catch {
      // Silent fail - could log error in future
    }
  },

  'BulkSave': async (cmd, emit) => {
    try {
      let success = 0;
      const entries = Object.entries((cmd as any).updates || {}) as Array<[string, Record<string, any>]>;
      const total = entries.length + ((cmd as any).newData ? 1 : 0);
      const rowsEndpointBaseRef = { current: null };

      for (const [rowId, data] of entries) {
        try {
          const res = await requestWithFallback('PATCH', (cmd as any).tableName, rowsEndpointBaseRef, rowId, data);
          if (res && res.ok) {
            success += 1;
            emit({ type: 'RowSaved', payload: { tableName: (cmd as any).tableName, rowId, data } });
          }
        } catch {
          // Continue processing remaining rows even if one update fails.
        }
      }

      if ((cmd as any).newData) {
        try {
          const res = await requestWithFallback('POST', (cmd as any).tableName, rowsEndpointBaseRef, undefined, (cmd as any).newData);
          if (res && res.ok) {
            success += 1;
            const json = await res.json().catch(() => ({}));
            const row: RowData = json.row || { id: `temp-${Date.now()}`, ...(cmd as any).newData };
            emit({ type: 'RowCreated', payload: { tableName: (cmd as any).tableName, row } });
          }
        } catch {
          // Non-blocking: keep partial success from batch updates.
        }
      }

      emit({ type: 'BulkSaveCompleted', payload: { tableName: (cmd as any).tableName, successCount: success, totalCount: total } });
    } catch {
      // Non-blocking: avoid crashing UI on unexpected bulk save error.
    }
  },

  'BulkDelete': async (cmd, emit) => {
    try {
      const ids = Array.isArray((cmd as any).rowIds) ? (cmd as any).rowIds : [];
      let success = 0;
      const rowsEndpointBaseRef = { current: null };
      for (const rowId of ids) {
        try {
          const res = await requestWithFallback('DELETE', (cmd as any).tableName, rowsEndpointBaseRef, rowId);
          if (res && res.ok) {
            success += 1;
            emit({ type: 'RowDeleted', payload: { tableName: (cmd as any).tableName, rowId } });
          }
        } catch {
          // Continue deleting remaining rows even if one request fails.
        }
      }
      emit({ type: 'BulkDeleteCompleted', payload: { tableName: (cmd as any).tableName, successCount: success, totalCount: ids.length } });
    } catch {
      // Non-blocking: avoid bubbling unexpected bulk delete failures.
    }
  },

  'BulkImport': async (cmd, emit) => {
    try {
      const rows = Array.isArray((cmd as any).rows) ? (cmd as any).rows : [];
      const rowsEndpointBaseRef = { current: null };
      let success = 0;
      for (const data of rows) {
        try {
          const res = await requestWithFallback('POST', (cmd as any).tableName, rowsEndpointBaseRef, undefined, data);
          if (res && res.ok) {
            success += 1;
            const json = await res.json().catch(() => ({}));
            const row: RowData = json.row || { id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...(data || {}) };
            emit({ type: 'RowCreated', payload: { tableName: (cmd as any).tableName, row } });
          }
        } catch {
          // Continue importing remaining rows on per-row failure.
        }
      }
      emit({ type: 'BulkImportCompleted', payload: { tableName: (cmd as any).tableName, successCount: success, totalCount: rows.length } });
    } catch {
      // Non-blocking: keep UI responsive if bulk import fails unexpectedly.
    }
  },
};
