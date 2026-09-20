export type AppBuildInfo = {
  readonly commit: string;
  readonly builtAt: string;
};

declare const __APP_BUILD_INFO__: AppBuildInfo | undefined;

export const APP_BUILD_INFO: AppBuildInfo =
  typeof __APP_BUILD_INFO__ !== "undefined"
    ? __APP_BUILD_INFO__
    : { commit: "development", builtAt: "" };
