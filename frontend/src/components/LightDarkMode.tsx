import React from "react";
import { useTranslation } from "react-i18next";
import { NavItem, UncontrolledTooltip } from "reactstrap";

//constants
import { LAYOUT_MODES } from "../constants/index";

interface LightDarkProps {
  layoutMode: any;
  onChangeLayoutMode: any;
}

const LightDarkMode = ({ layoutMode, onChangeLayoutMode }: LightDarkProps) => {
  const { t } = useTranslation();
  const mode =
    layoutMode === LAYOUT_MODES["DARK"]
      ? LAYOUT_MODES["LIGHT"]
      : LAYOUT_MODES["DARK"];
  return (
    <NavItem className="mt-auto" id="color-mode">
      <button
        type="button"
        className="nav-link light-dark"
        onClick={() => onChangeLayoutMode(mode)}
        aria-label={t("settings.switchMode", {
          mode: t(
            mode === LAYOUT_MODES["DARK"] ? "settings.dark" : "settings.light",
          ),
        })}
      >
        <i className="bx bx-moon" id="moon"></i>{" "}
      </button>{" "}
      <UncontrolledTooltip placement="right" target="color-mode">
        <span className="light-mode">{t("settings.light")}</span>
        <span className="dark-mode">{t("settings.dark")}</span>{" "}
        {t("settings.mode")}
      </UncontrolledTooltip>{" "}
    </NavItem>
  );
};

export default LightDarkMode;
