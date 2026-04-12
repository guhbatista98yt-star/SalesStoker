import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  ChevronRight,
  HelpCircle,
  Lightbulb,
  ListOrdered,
  MessageCircle,
  TriangleAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HelpContent } from "./help-content";

// ─── Tab types ────────────────────────────────────────────────────────────────

type Tab = "overview" | "guide" | "faq";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}

function TabButton({ active, onClick, icon: Icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ─── Warning / Tip boxes ──────────────────────────────────────────────────────

function WarningBox({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3.5 py-3">
      <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">{text}</p>
    </div>
  );
}

function TipBox({ text }: { text: string }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3.5 py-3">
      <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
      <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ content }: { content: HelpContent }) {
  return (
    <div className="space-y-4">
      {content.sections.map((section, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base leading-none">{section.icon}</span>
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed pl-6">
            {section.content}
          </p>
        </div>
      ))}

      {content.warning && <WarningBox text={content.warning} />}
      {content.tip && <TipBox text={content.tip} />}
    </div>
  );
}

// ─── Step guide tab ───────────────────────────────────────────────────────────

function GuideTab({ content }: { content: HelpContent }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Siga os passos abaixo para usar este módulo corretamente:
      </p>
      <ol className="space-y-3">
        {content.steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold border border-primary/20 mt-0.5">
              {i + 1}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
      {content.warning && <WarningBox text={content.warning} />}
    </div>
  );
}

// ─── FAQ tab ──────────────────────────────────────────────────────────────────

function FAQTab({ content }: { content: HelpContent }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Dúvidas mais comuns sobre este módulo:
      </p>
      {content.faqs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhuma dúvida frequente cadastrada para este módulo.
        </p>
      ) : (
        <Accordion type="multiple" className="space-y-1">
          {content.faqs.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="border border-border rounded-lg px-3 overflow-hidden"
            >
              <AccordionTrigger className="text-xs font-medium text-foreground py-3 hover:no-underline text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-3">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
      {content.tip && <TipBox text={content.tip} />}
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  content: HelpContent;
}

export function HelpDrawer({ open, onClose, content }: HelpDrawerProps) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[380px] p-0 flex flex-col gap-0"
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <HelpCircle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-sm font-semibold leading-tight">
                {content.title}
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{content.subtitle}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 p-1 bg-muted rounded-lg">
            <TabButton
              active={tab === "overview"}
              onClick={() => setTab("overview")}
              icon={BookOpen}
              label="Visão Geral"
            />
            <TabButton
              active={tab === "guide"}
              onClick={() => setTab("guide")}
              icon={ListOrdered}
              label="Passo a Passo"
            />
            <TabButton
              active={tab === "faq"}
              onClick={() => setTab("faq")}
              icon={MessageCircle}
              label="Dúvidas"
            />
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="px-4 py-4">
            {tab === "overview" && <OverviewTab content={content} />}
            {tab === "guide" && <GuideTab content={content} />}
            {tab === "faq" && <FAQTab content={content} />}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            CONECTUBOS • Ajuda contextual
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
