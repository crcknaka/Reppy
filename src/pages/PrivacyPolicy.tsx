import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyPolicy() {
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

        <h1 className="text-3xl font-bold mb-2">{t("legal.privacy.title")}</h1>
        <p className="text-muted-foreground mb-8">{t("legal.privacy.lastUpdated")}: January 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.intro.title")}</h2>
            <p className="text-muted-foreground">{t("legal.privacy.sections.intro.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.dataCollected.title")}</h2>
            <p className="text-muted-foreground mb-2">{t("legal.privacy.sections.dataCollected.intro")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{t("legal.privacy.sections.dataCollected.items.email")}</li>
              <li>{t("legal.privacy.sections.dataCollected.items.name")}</li>
              <li>{t("legal.privacy.sections.dataCollected.items.workouts")}</li>
              <li>{t("legal.privacy.sections.dataCollected.items.settings")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.dataUse.title")}</h2>
            <p className="text-muted-foreground mb-2">{t("legal.privacy.sections.dataUse.intro")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{t("legal.privacy.sections.dataUse.items.provide")}</li>
              <li>{t("legal.privacy.sections.dataUse.items.sync")}</li>
              <li>{t("legal.privacy.sections.dataUse.items.improve")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.dataStorage.title")}</h2>
            <p className="text-muted-foreground">{t("legal.privacy.sections.dataStorage.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.dataSharing.title")}</h2>
            <p className="text-muted-foreground">{t("legal.privacy.sections.dataSharing.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.userRights.title")}</h2>
            <p className="text-muted-foreground mb-2">{t("legal.privacy.sections.userRights.intro")}</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{t("legal.privacy.sections.userRights.items.access")}</li>
              <li>{t("legal.privacy.sections.userRights.items.export")}</li>
              <li>{t("legal.privacy.sections.userRights.items.delete")}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.cookies.title")}</h2>
            <p className="text-muted-foreground">{t("legal.privacy.sections.cookies.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.children.title")}</h2>
            <p className="text-muted-foreground">{t("legal.privacy.sections.children.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.changes.title")}</h2>
            <p className="text-muted-foreground">{t("legal.privacy.sections.changes.content")}</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">{t("legal.privacy.sections.contact.title")}</h2>
            <p className="text-muted-foreground">
              {t("legal.privacy.sections.contact.content")}{" "}
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
