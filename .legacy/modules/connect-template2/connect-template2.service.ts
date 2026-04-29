// frontend/src/modules/connect-template2/connect-template2.service.ts
import { logger } from '../../utils/logger';
import { fetchWithAuth } from '../../utils/fetch.utils';

// NOTE: ProtocolData imported from models but extended here with template-specific fields
export interface ProtocolData {
  id: string;
  name: string;
  created_at: string;
  test_kind?: string;
  notes?: string;
  final_result?: 'OK' | 'ERROR' | 'pending';
  final_result_ok?: boolean;
  final_result_error?: boolean;
  final_result_text?: string;
  device: {
    serial: string;
    kind: string;
    type: string;
  };
  client: {
    name: string;
    street: string;
    city: string;
    postcode: string;
    contact?: string;
    phone?: string;
    email?: string;
  };
  workshop?: {
    name?: string;
    street?: string;
    city?: string;
    postcode?: string;
    phone?: string;
    email?: string;
  };
  user: {
    name: string;
  };
  measurements: Array<{
    param_name: string;
    measured_value: string | number;
    unit: string;
    expected_value?: string | number;
    min_value?: string | number;
    max_value?: string | number;
    result?: string;
  }>;
  respiration_nd?: {
    title: string;
    unit: string;
    axis_min: number;
    axis_max: number;
    duration_sec: number;
    min_value: string;
    max_value: string;
    result: string;
    waveform: number[];
    svg_path?: string;
  };
  respiration_md?: {
    title: string;
    unit: string;
    axis_min: number;
    axis_max: number;
    duration_sec: number;
    min_value: string;
    max_value: string;
    result: string;
    waveform: number[];
    svg_path?: string;
  };
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  html_content: string;
  css_styles?: string;
  template_type: string;
  is_active: boolean;
  is_preset?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface TemplateVariable {
  id: string;
  name: string;
  description?: string;
  type: 'string' | 'number' | 'boolean' | 'date';
  default_value?: any;
}

export class ConnectTemplate2Service {
  private baseUrl = '/api/v3/data';
  private availableVariables: TemplateVariable[] = [];

  // Template CRUD operations
  async loadTemplates(): Promise<Template[]> {
    try {
      const response = await fetchWithAuth(`${this.baseUrl}/templates`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      // Handle various API response formats (backend returns {success, rows, total})
      const data = Array.isArray(json) ? json : (json?.rows || json?.data || json?.items || json?.templates || []);
      const dbTemplates = Array.isArray(data) ? data : [];
      
      // Filter out draft templates (only show published) and ensure is_active
      // Only return templates from database, no hardcoded presets
      const publishedTemplates = dbTemplates.filter((t: any) => 
        t.status !== 'draft' && (t.is_active === true || t.is_active === '1' || t.is_active === 1)
      );
      
      return publishedTemplates;
    } catch (error) {
      logger.error('Failed to load templates from API:', error);
      return [];
    }
  }

  async saveTemplate(template: Partial<Template>): Promise<Template> {
    try {
      const method = template.id ? 'PATCH' : 'POST';
      const url = template.id ? `${this.baseUrl}/templates/${template.id}` : `${this.baseUrl}/templates`;
      
      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Save template failed:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      
      // Backend returns {success, id, message} - construct full template object
      const savedTemplate: Template = {
        id: result.id || template.id || '',
        name: template.name || '',
        description: template.description,
        html_content: template.html_content || '',
        css_styles: template.css_styles,
        template_type: template.template_type || 'report',
        is_active: template.is_active ?? true,
        updated_at: new Date().toISOString()
      };
      
      logger.info('Template saved:', { id: savedTemplate.id, name: savedTemplate.name });
      return savedTemplate;
    } catch (error) {
      logger.error('Failed to save template:', error);
      throw error;
    }
  }

  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const response = await fetchWithAuth(`${this.baseUrl}/templates/${templateId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      logger.error('Failed to delete template:', error);
      throw error;
    }
  }

  /**
   * Load template draft from unified templates table (status='draft')
   * Returns the most recent draft for the given preset or templateId
   */
  async loadDraftFromDatabase(preset?: string, templateId?: string): Promise<{
    success: boolean;
    draft?: { id: string; name: string; html_content: string; css_styles: string; test_json?: string; updated_at: string };
  }> {
    try {
      // Build filters for backend query
      const filters: Record<string, string> = { status: 'draft' };
      if (preset) filters.preset = preset;
      if (templateId) filters.id = templateId;
      
      // Pass filters to backend to get the correct draft
      const filtersJson = encodeURIComponent(JSON.stringify(filters));
      const url = `${this.baseUrl}/templates?filters=${filtersJson}&limit=1`;
      const response = await fetchWithAuth(url);
      
      if (response.ok) {
        const data = await response.json();
        const rows = data?.rows || data?.data || [];
        
        if (rows.length > 0) {
          const draft = rows[0];
          logger.info('Found draft in database:', { id: draft.id, preset: draft.preset });
          return { success: true, draft };
        }
      }
      
      return { success: false };
    } catch (error) {
      logger.warn('Failed to load draft from database:', error);
      return { success: false };
    }
  }

  /**
   * Save template draft via HTTP POST to unified templates table.
   * Uses UPSERT logic - one draft per preset/templateId, always overwrites.
   * 
   * Architecture:
   * - Drafts are stored in `templates` table with status='draft'
   * - One draft per preset (msapp, standard, c10) or per template_id
   * - Autosave always updates existing draft, never creates duplicates
   * - "Save" button publishes draft (status='published')
   */
  async saveDraft(draft: {
    preset?: string;
    templateId?: string;
    name: string;
    html: string;
    css: string;
    testJson?: string;
  }): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      const response = await fetchWithAuth(`${this.baseUrl}/template_drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: draft.preset,
          template_id: draft.templateId,
          name: draft.name,
          html_content: draft.html,
          css_styles: draft.css,
          test_json: draft.testJson
        })
      });
      
      if (!response.ok) {
        const text = await response.text();
        logger.error('Draft save failed:', { status: response.status, body: text });
        return { success: false, error: `HTTP ${response.status}: ${text}` };
      }
      
      const result = await response.json();
      logger.debug('Draft saved:', { id: result.id, action: result.action, preset: draft.preset });
      return { success: true, id: result.id, action: result.action };
    } catch (error: any) {
      logger.warn('Draft save error:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  /**
   * Publish a draft template - changes status from 'draft' to 'published'.
   * Called when user clicks "Save" button.
   */
  async publishTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetchWithAuth(`${this.baseUrl}/templates/${templateId}/publish`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `HTTP ${response.status}: ${text}` };
      }
      
      const result = await response.json();
      logger.debug('Template published:', result);
      return { success: true };
    } catch (error: any) {
      logger.warn('Publish failed:', error);
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  // Backwards compatibility alias
  async saveDraftViaWebSocket(draft: {
    preset?: string;
    templateId?: string;
    name: string;
    html: string;
    css: string;
    testJson?: string;
  }): Promise<{ success: boolean; error?: string }> {
    return this.saveDraft(draft);
  }

  // Variable operations
  async loadAvailableVariables(): Promise<TemplateVariable[]> {
    try {
      // Load from multiple sources
      const [variables, dslParams] = await Promise.all([
        this.fetchVariables(),
        this.fetchDslParams()
      ]);
      
      this.availableVariables = [...variables, ...dslParams];
      return this.availableVariables;
    } catch (error) {
      logger.error('Failed to load variables:', error);
      return [];
    }
  }

  private async fetchVariables(): Promise<TemplateVariable[]> {
    try {
      const response = await fetchWithAuth(`${this.baseUrl}/variables`);
      if (!response.ok) return [];
      const data = await response.json();
      
      return data.map((v: any) => ({
        id: v.id || v.name,
        name: v.name,
        description: v.description,
        type: v.type || 'string',
        default_value: v.default_value
      }));
    } catch {
      return [];
    }
  }

  private async fetchDslParams(): Promise<TemplateVariable[]> {
    try {
      // Use shared DSL data service instead of direct fetch
      const { dslDataService } = await import('../../components/dsl');
      const data = await dslDataService.loadAll();
      
      return data.params.map(p => ({
        id: p.id,
        name: p.name,
        description: p.raw?.description || `DSL Parameter: ${p.name}`,
        type: 'string',
        default_value: p.raw?.default_value || ''
      }));
    } catch {
      return [];
    }
  }

  getAvailableVariables(): TemplateVariable[] {
    return this.availableVariables;
  }

  // Generate SVG path from waveform data points
  private generateSvgPath(waveform: number[], width: number = 200, height: number = 80): string {
    if (!waveform || waveform.length < 2) {
      return 'M0,40 L200,40'; // Flat line fallback
    }
    
    const points: string[] = [];
    const stepX = width / (waveform.length - 1);
    
    waveform.forEach((value, index) => {
      const x = index * stepX;
      const y = height - (value * height); // Invert Y (0 at bottom, 1 at top)
      
      if (index === 0) {
        points.push(`M${x.toFixed(1)},${y.toFixed(1)}`);
      } else {
        points.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
      }
    });
    
    return points.join(' ');
  }

  // Pre-process data to add computed fields (like SVG paths from waveforms)
  private preprocessData(data: any): any {
    const processed = { ...data };
    
    // Generate SVG paths for respiration charts
    if (processed.respiration_nd?.waveform) {
      processed.respiration_nd = {
        ...processed.respiration_nd,
        svg_path: this.generateSvgPath(processed.respiration_nd.waveform)
      };
    }
    
    if (processed.respiration_md?.waveform) {
      processed.respiration_md = {
        ...processed.respiration_md,
        svg_path: this.generateSvgPath(processed.respiration_md.waveform)
      };
    }
    
    return processed;
  }

  // Template rendering with data
  renderTemplate(htmlTemplate: string, cssTemplate: string, data: ProtocolData): string {
    // Pre-process data to generate computed fields
    const processedData = this.preprocessData(data);
    let rendered = htmlTemplate;
    
    // Simple mustache-like template rendering
    rendered = rendered.replace(/\{\{protocol\.(\w+)\}\}/g, (_match: string, prop: string) => {
      return String(processedData[prop as keyof ProtocolData] || '');
    });
    
    rendered = rendered.replace(/\{\{device\.(\w+)\}\}/g, (_match: string, prop: string) => {
      return String(processedData.device[prop as keyof typeof processedData.device] || '');
    });
    
    rendered = rendered.replace(/\{\{client\.(\w+)\}\}/g, (_match: string, prop: string) => {
      return String(processedData.client[prop as keyof typeof processedData.client] || '');
    });

    rendered = rendered.replace(/\{\{workshop\.(\w+)\}\}/g, (_match: string, prop: string) => {
      return String((processedData as any)?.workshop?.[prop] || '');
    });
    
    rendered = rendered.replace(/\{\{user\.(\w+)\}\}/g, (_match: string, prop: string) => {
      return String(processedData.user[prop as keyof typeof processedData.user] || '');
    });

    // Handle respiration_nd object
    rendered = rendered.replace(/\{\{respiration_nd\.(\w+)\}\}/g, (_match: string, prop: string) => {
      return String((processedData as any)?.respiration_nd?.[prop] ?? '');
    });

    // Handle respiration_md object
    rendered = rendered.replace(/\{\{respiration_md\.(\w+)\}\}/g, (_match: string, prop: string) => {
      return String((processedData as any)?.respiration_md?.[prop] ?? '');
    });
    
    // Handle measurements array
    rendered = rendered.replace(/\{\{#measurements\}\}(.*?)\{\{\/measurements\}\}/gs, (_match: string, inner: string) => {
      return processedData.measurements.map((measurement: any) => {
        let measurementHtml = inner;
        measurementHtml = measurementHtml.replace(/\{\{(\w+)\}\}/g, (_m: string, prop: string) => {
          return String(measurement[prop as keyof typeof measurement] || '');
        });
        return measurementHtml;
      }).join('');
    });
    
    // Wrap with CSS
    return `
      <style>${cssTemplate}</style>
      <div class="template-rendered">
        ${rendered}
      </div>
    `;
  }
}
