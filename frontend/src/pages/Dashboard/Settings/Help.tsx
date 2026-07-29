import React, { useState } from "react";
import { Button, Modal, ModalBody, ModalHeader } from "reactstrap";
import { useTranslation } from "react-i18next";

type HelpTopic = "faqs" | "contact" | "terms";

const Help = () => {
  const { t } = useTranslation();
  const [activeTopic, setActiveTopic] = useState<HelpTopic | null>(null);
  const helpContent: Record<
    HelpTopic,
    { title: string; body: React.ReactNode }
  > = {
    faqs: {
      title: t("settings.faqTitle"),
      body: (
        <>
          <h6>{t("settings.faqRealtimeQuestion")}</h6>
          <p>{t("settings.faqRealtimeAnswer")}</p>
          <h6>{t("settings.faqFilesQuestion")}</h6>
          <p className="mb-0">{t("settings.faqFilesAnswer")}</p>
        </>
      ),
    },
    contact: {
      title: t("settings.contactTitle"),
      body: <p className="mb-0">{t("settings.contactBody")}</p>,
    },
    terms: {
      title: t("settings.termsTitle"),
      body: <p className="mb-0">{t("settings.termsBody")}</p>,
    },
  };
  const topic = activeTopic ? helpContent[activeTopic] : null;

  return (
    <>
      <div className="accordion-body">
        <ul className="list-group list-group-flush">
          {(
            [
              ["faqs", t("settings.helpFaqs")],
              ["contact", t("settings.helpContact")],
              ["terms", t("settings.helpTerms")],
            ] as Array<[HelpTopic, string]>
          ).map(([key, label], index) => (
            <li
              key={key}
              className={`list-group-item py-3 px-0 ${
                index === 0 ? "pt-0" : ""
              } ${index === 2 ? "pb-0" : ""}`}
            >
              <Button
                type="button"
                color="link"
                className="text-body text-start p-0 font-size-13"
                onClick={() => setActiveTopic(key)}
              >
                {label}
              </Button>
            </li>
          ))}
        </ul>
      </div>
      <Modal
        isOpen={Boolean(topic)}
        toggle={() => setActiveTopic(null)}
        centered
      >
        <ModalHeader toggle={() => setActiveTopic(null)}>
          {topic?.title}
        </ModalHeader>
        <ModalBody>{topic?.body}</ModalBody>
      </Modal>
    </>
  );
};

export default Help;
