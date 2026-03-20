type HealthFailure = {
  module: string;
  dependency: string;
  message: string;
};

export const suggestHealthRemediation = (failures: HealthFailure[]) => {
  return failures.map((failure) => {
    if (failure.dependency === "DB") {
      return {
        module: failure.module,
        dependency: failure.dependency,
        suggestion:
          "Confirm the D1 binding exists in wrangler.jsonc and apply the task/system_logs migrations before retrying.",
      };
    }

    if (failure.dependency === "PRINTER_VPC") {
      return {
        module: failure.module,
        dependency: failure.dependency,
        suggestion:
          "Verify the VPC service ID, confirm the tunnel is healthy, and ensure the Raspberry Pi printer bridge is listening on port 8080.",
      };
    }

    return {
      module: failure.module,
      dependency: failure.dependency,
      suggestion: `Inspect the failing dependency and compare the runtime error with the latest system logs: ${failure.message}`,
    };
  });
};
