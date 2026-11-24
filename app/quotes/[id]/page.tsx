import { QuoteEditor } from "@/components/QuoteEditor";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuoteEditor id={id} />;
}
