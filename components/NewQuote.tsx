"use client";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useCreateQuote } from "@/lib/api.ts";
import { newQuoteSchema } from "@/lib/schemas.ts";
import { Alert, inputCls, Panel } from "./ui";

const SAMPLES = [
  { file: "motor-mount-bracket.png", label: "Motor mount bracket" },
  { file: "bearing-flange.png", label: "Bearing flange" },
  { file: "drive-shaft-spacer.png", label: "Drive shaft spacer" },
];
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

export function NewQuote() {
  const router = useRouter();
  const create = useCreateQuote();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currency, setCurrency] = useState<"USD" | "INR">("USD");
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);

  const add = (list: File[]) => {
    const ok = list.filter((f) => ACCEPT.includes(f.type) && f.size <= 8 * 1024 * 1024);
    const rejected = list.length - ok.length;
    setErrors((e) => ({ ...e, files: rejected ? `${rejected} file${rejected > 1 ? "s" : ""} skipped: use PNG, JPEG or WebP up to 8 MB.` : "" }));
    setFiles((prev) => [...prev, ...ok.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))].slice(0, 10));
  };

  async function addSample(file: string) {
    const blob = await (await fetch(`/samples/${file}`)).blob();
    add([new File([blob], file, { type: "image/png" })]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    add([...e.dataTransfer.files]);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = newQuoteSchema.safeParse({ customerName: name, customerEmail: email, currency });
    if (!parsed.success) {
      return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    }
    setErrors({});
    const form = new FormData();
    form.set("customerName", name);
    form.set("customerEmail", email);
    form.set("currency", currency);
    files.forEach((f) => form.append("drawings", f));
    create.mutate(form, { onSuccess: (r) => router.push(`/quotes/${r.id}${r.problems.length ? "?problems=" + encodeURIComponent(r.problems.join(" | ")) : ""}`) });
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New quote</h1>
        <p className="mt-1 text-sm text-stone-500">Add the customer and their drawings. Each drawing becomes a line you can review and edit.</p>
      </div>

      <Panel title="Customer">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_8rem]">
          <label className="text-sm">
            <span className="mb-1 block font-medium">Company</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Acme Robotics" />
            {errors.customerName && <span className="mt-1 block text-xs text-rose-700">{errors.customerName}</span>}
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Buyer email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="buyer@acme.example" />
            {errors.customerEmail && <span className="mt-1 block text-xs text-rose-700">{errors.customerEmail}</span>}
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Currency</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value as "USD" | "INR")} className={inputCls}>
              <option value="USD">USD $</option>
              <option value="INR">INR ₹</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel title="Drawings" action={<span className="text-xs text-stone-500">{files.length}/10</span>}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={`rounded-lg border-2 border-dashed px-6 py-9 text-center transition-colors ${drag ? "border-blueprint bg-blueprint-soft/40" : "border-stone-300"}`}
        >
          <p className="text-sm font-medium">Drop drawings here</p>
          <p className="mt-1 text-xs text-stone-500">PNG, JPEG or WebP, up to 8 MB each</p>
          <button type="button" onClick={() => input.current?.click()} className="mt-3 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50">
            Choose files
          </button>
          <input ref={input} type="file" accept={ACCEPT.join(",")} multiple hidden onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ""; }} />
        </div>
        {errors.files && <p className="mt-2 text-xs text-amber-700">{errors.files}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-500">Try a sample:</span>
          {SAMPLES.map((s) => (
            <button key={s.file} type="button" onClick={() => addSample(s.file)} className="rounded-md bg-blueprint-soft/70 px-2.5 py-1 text-xs font-medium text-blueprint hover:bg-blueprint-soft">
              + {s.label}
            </button>
          ))}
        </div>

        {files.length > 0 && (
          <ul className="mt-4 divide-y divide-stone-100 rounded-lg border border-stone-200">
            {files.map((f, i) => (
              <li key={f.name + i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="truncate font-mono text-xs">{f.name}</span>
                <span className="flex items-center gap-3 text-xs text-stone-500">
                  {(f.size / 1024).toFixed(0)} KB
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-stone-500 hover:text-rose-700" aria-label={`Remove ${f.name}`}>
                    Remove
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {files.length === 0 && <p className="mt-3 text-xs text-stone-500">No drawings? You can still create the quote and add parts by hand or from a CSV.</p>}
      </Panel>

      {create.error && <Alert tone="error">{create.error.message}</Alert>}
      <div className="flex justify-end">
        <button disabled={create.isPending} className="rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60">
          {create.isPending ? `Reading ${files.length || ""} drawing${files.length === 1 ? "" : "s"}…` : "Create quote"}
        </button>
      </div>
    </form>
  );
}
