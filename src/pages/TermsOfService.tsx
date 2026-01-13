import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TermsOfService() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <Link to="/auth">
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("common.back")}
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-2">{t("legal.terms.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("legal.terms.lastUpdated")}: January 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.acceptance.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.acceptance.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.description.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.description.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.account.title")}</h2>
            <p className="text-muted-foreground mb-2">{t("legal.terms.sections.account.intro")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{t("legal.terms.sections.account.items.accurate")}</li>
              <li>{t("legal.terms.sections.account.items.secure")}</li>
              <li>{t("legal.terms.sections.account.items.responsible")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.acceptable.title")}</h2>
            <p className="text-muted-foreground mb-2">{t("legal.terms.sections.acceptable.intro")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{t("legal.terms.sections.acceptable.items.illegal")}</li>
              <li>{t("legal.terms.sections.acceptable.items.harm")}</li>
              <li>{t("legal.terms.sections.acceptable.items.interfere")}</li>
              <li>{t("legal.terms.sections.acceptable.items.impersonate")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.content.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.content.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.intellectual.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.intellectual.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.disclaimer.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.disclaimer.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.limitation.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.limitation.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.termination.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.termination.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.changes.title")}</h2>
            <p className="text-muted-foreground">{t("legal.terms.sections.changes.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.terms.sections.contact.title")}</h2>
            <p className="text-muted-foreground">
              {t("legal.terms.sections.contact.content")}{" "}
              <a href="mailto:support@reppymate.com" className="text-primary hover:underline">
                support@reppymate.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
