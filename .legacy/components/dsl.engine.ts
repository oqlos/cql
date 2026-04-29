// frontend/src/components/dsl/dsl.engine.ts
// DSL Engine - Centralized DSL component management

import { logger } from '../../utils/logger';
import { parseDsl } from './dsl.parser';
import { highlightDsl } from './dsl.highlight';
import { executeDsl } from './dsl.exec';
import type { ExecContext } from './dsl.types';
import { validateDslFormat } from './dsl.validator';
import { dslDataService } from './dsl-data.service';
import { getJsonSchema, validateAst } from './dsl.schema';
import { DSL_XSD } from './dsl.xsd';
import { dslToXml, xmlToAst, astToXml } from './dsl.xml';
import { astToDslText } from './dsl.serialize.text';
import { validateAllTestScenarios, validateDslText } from './dsl.validate.db';
import { migrateLegacyXmlToDsl, migrateFilesToDb, postScenarioToDb, splitLegacyXmlToScenarios as splitLegacy } from './dsl.migrate.xml';
import { RELEASE_VERSION } from '../../config/release-version';

export interface DslParseResult {
  ok: boolean;
  errors: string[];
  ast: any;
}

export interface DslExecuteResult extends DslParseResult {
  plan: any[];
}

export interface DslValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  violations: any[];
  fixedText?: string;
}

/**
 * DSL Engine - Centralized access to all DSL functionality
 * Provides lazy loading, caching, and consistent API
 */
export class DslEngine {
  private initialized = false;
  private dataCache: any = null;

  /**
   * Initialize DSL engine (called automatically on first use)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Pre-load DSL data for better performance
      this.dataCache = await dslDataService.loadAll();
      this.initialized = true;
    } catch (error) {
      logger.warn('DSL Engine: Failed to pre-load data, will load on-demand', error);
      this.initialized = true; // Still mark as initialized to avoid retry loops
    }
  }

  /**
   * Parse DSL text into AST
   */
  parse(text: string): DslParseResult {
    return parseDsl(text);
  }

  /**
   * Highlight DSL syntax for display
   */
  highlight(text: string): string {
    return highlightDsl(text);
  }

  /**
   * Execute DSL and return execution plan
   */
  execute(text: string, ctx?: ExecContext): DslExecuteResult {
    return executeDsl(text, ctx as any);
  }

  /**
   * Validate DSL format and get suggestions
   */
  validate(text: string): DslValidateResult {
    return validateDslFormat(text);
  }

  /**
   * Validate parsed AST against strict schema
   */
  validateAst(ast: unknown): { ok: boolean; errors: string[] } {
    const res = validateAst(ast);
    return { ok: !!res.ok, errors: (res as any).errors || [] };
  }

  /** Schema (JSON-Schema draft-07) */
  getJsonSchema(): any { return getJsonSchema(); }

  /** XSD for XML representation */
  getXsd(): string { return DSL_XSD; }

  /** Convert DSL text -> XML (using AST) */
  toXml(text: string): { ok: boolean; xml?: string; errors?: string[] } { return dslToXml(text); }

  /** Convert AST -> XML */
  astToXml(ast: any): string { return astToXml(ast as any); }

  /** Convert AST -> DSL text */
  astToDslText(ast: any): string { return astToDslText(ast as any); }

  /** Parse XML -> AST */
  xmlToAst(xml: string): { ok: boolean; ast?: any; errors?: string[] } { return xmlToAst(xml) as any; }

  /** Validate single DSL text (parse + schema + xml gen) */
  validateDslText(text: string) { return validateDslText(text); }

  /** Validate all test_scenarios from DB (GET /api/v3/data/test_scenarios) */
  async validateDbScenarios() { return await validateAllTestScenarios(); }

  /** Legacy XML -> DSL migration helpers */
  migrateLegacyXmlToDsl(xml: string, nameHint?: string) { return migrateLegacyXmlToDsl(xml, nameHint); }
  async migrateFilesToDb(files: FileList | File[], nameFromFile = true) { return await migrateFilesToDb(files, nameFromFile); }
  async postScenarioToDb(name: string, dsl: string) { return await postScenarioToDb(name, dsl); }

  /** Split single legacy XML into multiple scenarios (name + dsl + ast) */
  splitLegacyXmlToScenarios(xml: string, nameHint?: string) { return splitLegacy(xml, nameHint); }

  /**
   * Get DSL data (objects, functions, params, units)
   */
  async getData(): Promise<any> {
    await this.initialize();
    if (!this.dataCache) {
      this.dataCache = await dslDataService.loadAll();
    }
    return this.dataCache;
  }

  /**
   * Clear data cache (force reload on next getData call)
   */
  clearCache(): void {
    this.dataCache = null;
  }

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get version info
   */
  getVersion(): string {
    return RELEASE_VERSION;
  }
}
