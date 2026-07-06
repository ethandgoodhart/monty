import { Tweet } from "react-tweet";

const row1 = [
  "2011742378655432791",
  "2010605025844723765",
  "2012679608659771424",
  "2011673080062681560",
  "2010430366944055433",
];

const row2 = [
  "2011214857614606435",
  "2010801019572412680",
  "2012477771054805281",
  "2011742378655432791",
  "2010605025844723765",
];

function TweetRow({ ids, direction }: { ids: string[]; direction: "left" | "right" }) {
  const animation = direction === "left"
    ? "scroll-left 60s linear infinite"
    : "scroll-right 60s linear infinite";

  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
        WebkitMaskImage: "linear-gradient(to right, transparent, black 5%, black 95%, transparent)",
      }}
    >
      <div className="flex w-max" style={{ animation }}>
        {[0, 1, 2].map((set) => (
          <div key={set} className="flex shrink-0 gap-4 pr-4" aria-hidden={set > 0}>
            {ids.map((id, i) => (
              <div
                key={`${id}-${i}`}
                className="w-[350px] shrink-0 overflow-hidden [&>div]:!mt-0"
                style={{
                  zoom: 0.7,
                  height: 310,
                  maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                }}
              >
                <Tweet id={id} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-24 overflow-hidden">
      <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-10 mb-12">
        <h2 className="text-[#111]" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.25rem)", lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.01em" }}>
          What people are saying
        </h2>
      </div>
      <div className="flex flex-col gap-4">
        <TweetRow ids={row1} direction="left" />
        <TweetRow ids={row2} direction="right" />
      </div>
    </section>
  );
}
