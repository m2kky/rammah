import proxyAddr from "proxy-addr";

export type TrustedProxyPredicate = (ipAddress: string, hop?: number) => boolean;

export const compileTrustedProxyCidrs = (
  cidrs: readonly string[],
): TrustedProxyPredicate => {
  if (cidrs.length === 0) return () => false;

  const compiled = proxyAddr.compile([...cidrs]);
  return (ipAddress, hop = 0) => {
    try {
      return compiled(ipAddress, hop);
    } catch {
      return false;
    }
  };
};
