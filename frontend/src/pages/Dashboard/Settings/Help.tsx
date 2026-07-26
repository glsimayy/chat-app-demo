import React, { useState } from "react";
import { Button, Modal, ModalBody, ModalHeader } from "reactstrap";

type HelpTopic = "faqs" | "contact" | "terms";

const helpContent: Record<HelpTopic, { title: string; body: React.ReactNode }> =
  {
    faqs: {
      title: "Frequently asked questions",
      body: (
        <>
          <h6>Why do messages sometimes take a moment to appear?</h6>
          <p>
            The app retries over the REST API if the real-time connection drops.
          </p>
          <h6>Which files can I send?</h6>
          <p className="mb-0">
            Images, PDFs, Office documents and common text files are supported.
          </p>
        </>
      ),
    },
    contact: {
      title: "Contact support",
      body: (
        <p className="mb-0">
          Open Support from the left navigation to create a ticket and follow
          its status.
        </p>
      ),
    },
    terms: {
      title: "Terms & Privacy policy",
      body: (
        <p className="mb-0">
          This is a demonstration environment. Account details, messages,
          attachments and call metadata may be stored for testing, so do not use
          production-sensitive information.
        </p>
      ),
    },
  };

const Help = () => {
  const [activeTopic, setActiveTopic] = useState<HelpTopic | null>(null);
  const topic = activeTopic ? helpContent[activeTopic] : null;

  return (
    <>
      <div className="accordion-body">
        <ul className="list-group list-group-flush">
          {(
            [
              ["faqs", "FAQs"],
              ["contact", "Contact"],
              ["terms", "Terms & Privacy policy"],
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
