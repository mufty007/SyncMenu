import { useState, type FormEvent } from "react";
import { Clock, Mail, MessageCircleQuestion } from "lucide-react";
import Reveal from "../components/Reveal";
import { SiteFooter, SiteHeader } from "../components/SiteChrome";

const SUPPORT_EMAIL = "support@syncmenu.app";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent(`SyncMenu — message from ${name || "a visitor"}`);
    const body = encodeURIComponent(`${message}\n\n— ${name}${email ? ` (${email})` : ""}`);
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />

      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <Reveal>
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold md:text-5xl">
              Talk to a human
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-smoke">
              Question about screens, pricing, or getting your first menu live?
              We answer fast — owners are busy, we get it.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid items-start gap-6 lg:grid-cols-[340px_1fr]">
          <div className="space-y-4">
            {[
              {
                icon: Mail,
                title: "Email us",
                body: (
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-brand">
                    {SUPPORT_EMAIL}
                  </a>
                ),
              },
              {
                icon: Clock,
                title: "Response time",
                body: "Usually within one business day — faster on weekdays.",
              },
              {
                icon: MessageCircleQuestion,
                title: "Before you write",
                body: "Pairing or sync issues? Try reloading the TV player first — it reconnects automatically.",
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 100}>
                <div className="card lift flex gap-4 p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10">
                    <Icon size={19} className="text-brand" />
                  </div>
                  <div>
                    <p className="font-semibold">{title}</p>
                    <p className="mt-1 text-sm text-smoke">{body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={150}>
            <form onSubmit={handleSubmit} className="card p-7">
              <h2 className="text-lg font-semibold">Send a message</h2>
              <p className="mt-1 text-xs text-smoke">
                This opens your email app with everything filled in.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="c-name">
                    Your name
                  </label>
                  <input
                    id="c-name"
                    className="input"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="c-email">
                    Email
                  </label>
                  <input
                    id="c-email"
                    type="email"
                    className="input"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="label" htmlFor="c-message">
                  Message
                </label>
                <textarea
                  id="c-message"
                  rows={6}
                  className="input resize-y"
                  required
                  placeholder="Tell us about your shop and what you need…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary mt-5">
                <Mail size={15} /> Send message
              </button>
            </form>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
