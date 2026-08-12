import { useEffect } from "react";

export function WebAdBanner() {
  useEffect(() => {
    try {
      // Initialize Google AdSense container if adsbygoogle exists in document window
      const win = window as unknown as { adsbygoogle?: unknown[] };
      if (win.adsbygoogle) {
        win.adsbygoogle.push({});
      }
    } catch {
      /* ignore ad script errors */
    }
  }, []);

  return (
    <div className="mx-auto my-2 flex w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-card/60 px-2 py-1.5 shadow-sm text-center">
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: "100%", height: "50px" }}
        data-ad-client="ca-pub-5732060577215447"
        data-ad-slot="6392367110"
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
