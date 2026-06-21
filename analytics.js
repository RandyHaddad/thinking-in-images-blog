(function () {
  const config = window.__ARTICLE_ANALYTICS__ || {};
  const token = config.posthogToken || "";

  if (!token || token.startsWith("REPLACE_WITH_")) {
    console.info("PostHog analytics disabled: set window.__ARTICLE_ANALYTICS__.posthogToken.");
    return;
  }

  const article = document.querySelector("[data-article-slug]");
  const articleSlug = config.articleSlug || article?.dataset.articleSlug || "unknown_article";
  const hostname = window.location.hostname;
  const cohortByHost = config.cohortByHost || {};
  const distributionHost = hostname || "local_file";

  function inferCohort(host) {
    if (cohortByHost[host]) return cohortByHost[host];
    if (host.endsWith(".netlify.app")) return host.split(".")[0];
    if (host.endsWith(".github.io")) return "github_pages";
    if (!host) return "local_file";
    return host.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase();
  }

  const commonProps = {
    article_slug: articleSlug,
    link_cohort: inferCohort(hostname),
    distribution_host: distributionHost,
    distribution_origin: window.location.origin,
    page_path: window.location.pathname,
    article_version: "x_article_posthog_v1"
  };

  function loadPostHogSnippet() {
    // Official snippet shape, kept local so cohort registration can happen before manual pageview.
    (function (t, e) {
      var o, n, p, r;
      e.__SV ||
        ((window.posthog = e),
        (e._i = []),
        (e.init = function (i, s, a) {
          function g(t, e) {
            var o = e.split(".");
            2 == o.length && ((t = t[o[0]]), (e = o[1]));
            t[e] = function () {
              t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
            };
          }
          ((p = t.createElement("script")).type = "text/javascript"),
            (p.crossOrigin = "anonymous"),
            (p.async = !0),
            (p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"),
            (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r);
          var u = e;
          for (
            void 0 !== a ? (u = e[a] = []) : (a = "posthog"),
              u.people = u.people || [],
              u.toString = function (t) {
                var e = "posthog";
                return "posthog" !== a && (e += "." + a), t || (e += " (stub)"), e;
              },
              u.people.toString = function () {
                return u.toString(1) + ".people (stub)";
              },
              o =
                "init capture register register_once unregister identify alias set_config reset people.set people.set_once group".split(
                  " "
                ),
              n = 0;
            n < o.length;
            n++
          )
            g(u, o[n]);
          e._i.push([i, s, a]);
        }),
        (e.__SV = 1));
    })(document, window.posthog || []);
  }

  function visibleSecondsTracker(onTick) {
    let visible = document.visibilityState === "visible";
    let visibleSeconds = 0;

    const interval = window.setInterval(function () {
      if (visible) {
        visibleSeconds += 1;
        onTick(visibleSeconds);
      }
    }, 1000);

    document.addEventListener("visibilitychange", function () {
      visible = document.visibilityState === "visible";
    });

    return {
      seconds: function () {
        return visibleSeconds;
      },
      stop: function () {
        window.clearInterval(interval);
      }
    };
  }

  function articleDepthPercent() {
    const target = article || document.body;
    const rect = target.getBoundingClientRect();
    const articleTop = window.scrollY + rect.top;
    const articleHeight = Math.max(target.scrollHeight, rect.height, 1);
    const viewportBottom = window.scrollY + window.innerHeight;
    return Math.max(0, Math.min(100, Math.round(((viewportBottom - articleTop) / articleHeight) * 100)));
  }

  function setupArticleEvents(posthog) {
    const firedDepths = new Set();
    const depthThresholds = [25, 50, 75, 90, 100];
    const firedTime = new Set();
    const timeThresholds = [10, 30, 60, 120, 300];

    posthog.capture("article_read_started", {
      ...commonProps,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      referrer: document.referrer || null
    });

    function checkDepth() {
      const depth = articleDepthPercent();
      for (const threshold of depthThresholds) {
        if (depth >= threshold && !firedDepths.has(threshold)) {
          firedDepths.add(threshold);
          posthog.capture("article_scroll_depth", {
            ...commonProps,
            depth_percent: threshold,
            current_depth_percent: depth
          });
        }
      }
    }

    let depthTicking = false;
    window.addEventListener(
      "scroll",
      function () {
        if (depthTicking) return;
        depthTicking = true;
        window.requestAnimationFrame(function () {
          depthTicking = false;
          checkDepth();
        });
      },
      { passive: true }
    );
    window.addEventListener("resize", checkDepth);
    checkDepth();

    const visibleTracker = visibleSecondsTracker(function (seconds) {
      for (const threshold of timeThresholds) {
        if (seconds >= threshold && !firedTime.has(threshold)) {
          firedTime.add(threshold);
          posthog.capture("article_engaged_time", {
            ...commonProps,
            engaged_seconds: threshold
          });
        }
      }
    });

    document.querySelectorAll(".figure a[href]").forEach(function (link, index) {
      link.addEventListener("click", function () {
        posthog.capture("article_image_opened", {
          ...commonProps,
          image_index: index,
          image_href: link.getAttribute("href")
        });
      });
    });

    window.addEventListener("pagehide", function () {
      posthog.capture("article_session_summary", {
        ...commonProps,
        engaged_seconds: visibleTracker.seconds(),
        final_depth_percent: articleDepthPercent()
      });
      visibleTracker.stop();
    });
  }

  loadPostHogSnippet();

  window.posthog.init(token, {
    api_host: config.posthogHost || "https://us.i.posthog.com",
    defaults: "2026-01-30",
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: false,
    person_profiles: "identified_only",
    loaded: function (posthog) {
      posthog.register(commonProps);
      posthog.capture("$pageview", commonProps);
      setupArticleEvents(posthog);
    }
  });
})();
