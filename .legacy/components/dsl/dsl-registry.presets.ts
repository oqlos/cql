// frontend/src/components/dsl/dsl-registry.presets.ts
// Extracted preset/factory builders for DslRegistry

import { DslRegistry } from './dsl-registry';
import type { RegistryConfig } from './dsl-registry.types';

let globalRegistry: DslRegistry | null = null;

export function getGlobalRegistry(): DslRegistry {
  if (!globalRegistry) {
    globalRegistry = new DslRegistry();
  }
  return globalRegistry;
}

export function createRegistry(config?: RegistryConfig): DslRegistry {
  return new DslRegistry(config);
}

export function setGlobalRegistry(registry: DslRegistry): void {
  globalRegistry = registry;
  (globalThis as any).__dslRegistry = registry;
}

/**
 * Create registry with common hardware mappings
 */
export function createHardwareRegistry(backendUrl: string = '/api/v3/dsl'): DslRegistry {
  const registry = new DslRegistry({ backendUrl });

  // Register common pump actions
  for (let i = 1; i <= 4; i++) {
    registry.registerTaskMapping(`pompa ${i}`, 'Włącz', {
      kind: 'api',
      url: `${backendUrl}/hardware/pump/${i}/on`,
      method: 'POST',
    });
    registry.registerTaskMapping(`pompa ${i}`, 'Wyłącz', {
      kind: 'api',
      url: `${backendUrl}/hardware/pump/${i}/off`,
      method: 'POST',
    });
  }

  // Register common valve actions
  for (const valve of ['BO04', 'BO05', 'BO06']) {
    registry.registerTaskMapping(`zawór ${valve}`, 'Otwórz', {
      kind: 'api',
      url: `${backendUrl}/hardware/valve/${valve}/open`,
      method: 'POST',
    });
    registry.registerTaskMapping(`zawór ${valve}`, 'Zamknij', {
      kind: 'api',
      url: `${backendUrl}/hardware/valve/${valve}/close`,
      method: 'POST',
    });
  }

  // Register common sensors
  registry.registerParamMapping('ciśnienie', {
    kind: 'api',
    url: `${backendUrl}/sensors/AI01/value`,
    sensor: 'AI01',
    unit: 'bar',
  });
  registry.registerParamMapping('ciśnienie NC', {
    kind: 'api',
    url: `${backendUrl}/sensors/AI01/value`,
    sensor: 'AI01',
    unit: 'mbar',
  });
  registry.registerParamMapping('ciśnienie SC', {
    kind: 'api',
    url: `${backendUrl}/sensors/AI02/value`,
    sensor: 'AI02',
    unit: 'bar',
  });

  return registry;
}
