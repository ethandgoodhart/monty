const TITLE = [
  "88b           d88                                                                                    ",
  "888b         d888                             ,d                                                     ",
  "88`8b       d8'88                             88                                                     ",
  "88 `8b     d8' 88   ,adPPYba,   8b,dPPYba,  MM88MMM  ,adPPYba,  8b,dPPYba,   ,adPPYba,  8b       d8  ",
  "88  `8b   d8'  88  a8\"     \"8a  88P'   `\"8a   88    a8P_____88  88P'   \"Y8  a8P_____88  `8b     d8'  ",
  "88   `8b d8'   88  8b       d8  88       88   88    8PP\"\"\"\"\"\"\"  88          8PP\"\"\"\"\"\"\"   `8b   d8'   ",
  "88    `888'    88  \"8a,   ,a8\"  88       88   88,   \"8b,   ,aa  88          \"8b,   ,aa    `8b,d8'    ",
  "88     `8'     88   `\"YbbdP\"'   88       88   \"Y888  `\"Ybbd8\"'  88           `\"Ybbd8\"'      Y88'     ",
  "                                                                                            d8'      ",
  "                                                                                           d8'       ",
].join("\n");

export default function Home() {
  return (
    <main>
      <div className="ascii-bg" aria-hidden="true">
        <video src="/ascii.mp4" autoPlay loop muted playsInline />
      </div>
      <h1 className="title">
        <pre>{TITLE}</pre>
      </h1>
      <a className="contact" href="mailto:founders@trymonty.ai">
        Contact Us
      </a>
    </main>
  );
}
