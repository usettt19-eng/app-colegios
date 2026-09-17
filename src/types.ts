/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DBColumn {
  name: string;
  type: string;
  key?: "PK" | "FK" | "";
  nullable: boolean;
  references?: string;
  description: string;
}

export interface DBTable {
  name: string;
  description: string;
  columns: DBColumn[];
  relationships: string[];
}

export interface RESTEndpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  headers: { [key: string]: string };
  requestBody?: string;
  responseBody: string;
}

export interface ModuleInfo {
  id: string;
  title: string;
  icon: string;
  description: string;
  detailedFeatures: string[];
  integrationFlow: string;
  dbEntities: string[];
  restEndpoints: string[];
}

export interface PortalConfig {
  id: "admin" | "teacher" | "student_parent";
  title: string;
  subtitle: string;
  audience: string;
  features: string[];
  metrics: { label: string; value: string; trend?: string; color?: string }[];
}

export interface SandboxLog {
  timestamp: string;
  text: string;
  type: "info" | "success" | "warn" | "error";
}

export interface AIChatMessage {
  role: "user" | "model";
  content: string;
}
