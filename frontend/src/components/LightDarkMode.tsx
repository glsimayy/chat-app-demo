import React from "react";
import { NavItem, UncontrolledTooltip } from "reactstrap";

//constants
import { LAYOUT_MODES } from "../constants/index";

interface LightDarkProps {
  layoutMode: any;
  onChangeLayoutMode: any;
}

const LightDarkMode = ({ layoutMode, onChangeLayoutMode }: LightDarkProps) => {
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
        aria-label={`Switch to ${mode} mode`}
      >
        <i className="bx bx-moon" id="moon"></i>{" "}
      </button>{" "}
      <UncontrolledTooltip placement="right" target="color-mode">
        <span className="light-mode">Light</span>
        <span className="dark-mode">Dark</span> Mode{" "}
      </UncontrolledTooltip>{" "}
    </NavItem>
  );
};

export default LightDarkMode;
