import React, { FormEvent, useEffect, useState } from "react";
import { Button, Form, Input, Label, Spinner } from "reactstrap";

import { BasicDetailsTypes } from "../../../data/settings";

interface PersonalInfoProps {
  basicDetails: BasicDetailsTypes;
  onSave: (updates: {
    username: string;
    about: string;
    location: string;
  }) => Promise<boolean>;
}

const PersonalInfo = ({ basicDetails, onSave }: PersonalInfoProps) => {
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
          <Label htmlFor="profile-username">Username</Label>
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
          <Label htmlFor="profile-about">About</Label>
          <Input
            id="profile-about"
            type="textarea"
            rows={3}
            value={about}
            onChange={event => setAbout(event.target.value)}
            maxLength={240}
            placeholder="A short note visible on your profile"
          />
          <small className="text-muted">{about.length}/240</small>
        </div>
        <div className="mb-3">
          <Label htmlFor="profile-location">Location</Label>
          <Input
            id="profile-location"
            value={location}
            onChange={event => setLocation(event.target.value)}
            maxLength={100}
            placeholder="City, country"
          />
        </div>
        <div className="d-flex gap-2">
          <Button color="primary" type="submit" disabled={saving}>
            {saving ? <Spinner size="sm" className="me-2" /> : null}
            Save profile
          </Button>
          <Button
            color="light"
            type="button"
            onClick={cancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </Form>
    );
  }

  return (
    <div className="accordion-body profile-info-summary">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div>
          <p className="text-muted mb-1">Username</p>
          <h5 className="font-size-14 mb-0">{basicDetails.username}</h5>
        </div>
        <Button
          color="light"
          size="sm"
          type="button"
          aria-label="Edit personal info"
          title="Edit personal info"
          onClick={() => setEditing(true)}
        >
          <i className="bx bxs-pencil" aria-hidden="true"></i>
        </Button>
      </div>
      <div className="mb-3">
        <p className="text-muted mb-1">Email</p>
        <h5 className="font-size-14 mb-0 text-break">{basicDetails.email}</h5>
      </div>
      <div className="mb-3">
        <p className="text-muted mb-1">About</p>
        <p className="mb-0">{basicDetails.about || "No profile note yet."}</p>
      </div>
      <div>
        <p className="text-muted mb-1">Location</p>
        <p className="mb-0">{basicDetails.location || "Not specified"}</p>
      </div>
    </div>
  );
};

export default PersonalInfo;
