declare module 'ovh' {
  interface OVHConfig {
    appKey: string;
    appSecret: string;
    consumerKey: string;
    endpoint: string;
  }

  interface OVHClient {
    request<T = any>(
      method: 'GET' | 'POST' | 'PUT' | 'DELETE',
      path: string,
      params?: Record<string, any>,
      body?: Record<string, any>
    ): Promise<T>;
  }

  function createClient(config: OVHConfig): OVHClient;

  export default createClient;
}
