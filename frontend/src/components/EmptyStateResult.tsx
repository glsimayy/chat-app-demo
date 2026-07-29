import React from "react";
import { useTranslation } from "react-i18next";

interface EmptyStateContactsProps {
  searchedText: string;
}
const EmptyStateContacts = ({ searchedText }: EmptyStateContactsProps) => {
  const { t } = useTranslation();

  return (
    <div className="rounded p-4 text-center">
      <i className="bx bx-info-circle fs-1 mb-3" />
      <div>{t("contacts.noResults", { search: searchedText })}</div>
    </div>
  );
};

export default EmptyStateContacts;
