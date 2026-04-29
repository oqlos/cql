// frontend/src/components/dsl-table/dsl-table.types.ts
// Shared types for DSL Table component

export type DslTableDefinition = {
  type: string;
  name: string;
  units?: string;
};

export type DslTableRuntime =
  | Record<string, any>
  | {
      params?: Record<string, any>;
      objects?: Record<string, any>;
      functions?: Record<string, any>;
    }
  | Array<{ type: string; name: string; value?: any }>;
