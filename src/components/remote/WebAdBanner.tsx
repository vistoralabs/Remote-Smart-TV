import { useEffect, useRef, useState } from "react";

export function WebAdBanner() {
  const [adLoaded, setAdLoaded] = useState(false);
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    try {
      const win = window as unknown as { adsbygoogle?: unknown[] };
      if (win.adsbygoogle) {
        win.adsbygoogle.push({});
      }
    } catch {
      /* ignore ad script errors */
    }

    const checkAd = () => {
      if (insRef.current) {
        const hasIframe = insRef.current.querySelector("iframe") !== null;
        const status = insRef.current.getAttribute("data-ad-status");
        if (hasIframe || status === "filled") {
          setAdLoaded(true);
        }
      }
    };

    const timer = setInterval(checkAd, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={
        adLoaded
          ? "mx-auto my-1 flex w-full max-w-md shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/40 bg-card/60 px-2 py-1 text-center shadow-sm"
          : "hidden"
      }
    >
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: adLoaded ? "block" : "none", width: "100%", height: adLoaded ? "50px" : "0px" }}
        data-ad-client="ca-pub-5732060577215447"
        data-ad-slot="6392367110"
        data-ad-format="horizontal"
        data-full-width-responsive="true"
      />
    </div>
  );
}
