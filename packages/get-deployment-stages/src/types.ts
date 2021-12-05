export interface Environment {
  name: string;
  transient_environment: boolean;
  production_environment: boolean;
  payload?: {
    project: string;
  };
}
