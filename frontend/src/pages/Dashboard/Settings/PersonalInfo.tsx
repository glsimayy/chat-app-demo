import React, { FormEvent, useEffect, useState } from "react";
import { Button, Form, Input, Label, Spinner } from "reactstrap";

import { BasicDetailsTypes } from "../../../data/settings";
import { useTranslation } from "react-i18next";

interface PersonalInfoProps {
  basicDetails: BasicDetailsTypes;
  onSave: (updates: {
    username: string;
    about: string;
    location: string;
  }) => Promise<boolean>;
}

const PersonalInfo = ({ basicDetails, onSave }: PersonalInfoProps) => {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState(basicDetails.username);
  const [about, setAbout] = useState(basicDetails.about);
  const [location, setLocation] = useState(basicDetails.location);

  useEffect(() => {
    setUsername(basicDetails.username);
    setAbout(basicDetails.about);
    setLocation(basicDetails.location);
  }, [basicDetails]);

  const cancel = () => {
    setUsername(basicDetails.username);
    setAbout(basicDetails.about);
    setLocation(basicDetails.location);
    setEditing(false);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (await onSave({ username, about, location })) {
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <Form className="accordion-body profile-info-form" onSubmit={submit}>
        <div className="mb-3">
          <Label htmlFor="profile-username">{t("auth.username")}</Label>
          <Input
            id="profile-username"
            value={username}
            onChange={event => setUsername(event.target.value)}
            minLength={3}
            maxLength={30}
            pattern="[A-Za-z0-9_]+"
            required
          />
        </div>
        <div className="mb-3">
          <Label htmlFor="profile-about">{t("settings.about")}</Label>
          <Input
            id="profile-about"
            type="textarea"
            rows={3}
            value={about}
            onChange={event => setAbout(event.target.value)}
            maxLength={240}
            placeholder={t("settings.profileNotePlaceholder")}
          />
          <small className="text-muted">{about.length}/240</small>
        </div>
        <div className="mb-3">
          <Label htmlFor="profile-location">{t("settings.location")}</Label>
          <Input
            id="profile-location"
            value={location}
            onChange={event => setLocation(event.target.value)}
            maxLength={100}
            placeholder={t("settings.locationPlaceholder")}
          />
        </div>
        <div className="d-flex gap-2">
          <Button color="primary" type="submit" disabled={saving}>
            {saving ? <Spinner size="sm" className="me-2" /> : null}
            {t("settings.saveProfile")}
          </Button>
          <Button
            color="light"
            type="button"
            onClick={cancel}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </Form>
    );
  }

  return (
    <div className="accordion-body profile-info-summary">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <p className="text-muted mb-1">{t("auth.username")}</p>
          <h5 className="font-size-14 mb-0">{basicDetails.username}</h5>
        </div>
        <Button
          color="light"
          size="sm"
          type="button"
          aria-label={t("settings.editPersonalInfo")}
          title={t("settings.editPersonalInfo")}
          onClick={() => setEditing(true)}
        >
          <i className="bx bxs-pencil" aria-hidden="true"></i>
        </Button>
      </div>
      <div className="mb-3">
        <p className="text-muted mb-1">{t("auth.email")}</p>
        <h5 className="font-size-14 mb-0 text-break">{basicDetails.email}</h5>
      </div>
      <div className="mb-3">
        <p className="text-muted mb-1">{t("settings.about")}</p>
        <p className="mb-0">
          {basicDetails.about || t("settings.noProfileNote")}
        </p>
      </div>
      <div>
        <p className="text-muted mb-1">{t("settings.location")}</p>
        <p className="mb-0">
          {basicDetails.location || t("settings.notSpecified")}
        </p>
      </div>
    </div>
  );
};

export default PersonalInfo;
