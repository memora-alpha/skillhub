export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type ResultReference = { id: string; status: string; version?: number };

export type IdempotencyInput = {
  scope: string;
  operation: string;
  key: string;
  command: JsonValue;
};
