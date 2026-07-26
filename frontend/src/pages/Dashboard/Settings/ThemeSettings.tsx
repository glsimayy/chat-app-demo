import React from "react";
import { createSelector } from "reselect";

// interface
import { ThemeTypes } from "../../../data/settings";
import { LAYOUT_MODES } from "../../../constants";
import { changelayoutMode } from "../../../redux/actions";
import { useRedux } from "../../../hooks";

// components
import ThemeColor from "./ThemeColor";
import ThemeImage from "./ThemeImage";

interface ThemeSettingsProps {
  theme: ThemeTypes;
  onChangeData: (field: string, value: any) => void;
}
const ThemeSettings = ({ theme, onChangeData }: ThemeSettingsProps) => {
  const { dispatch, useAppSelector } = useRedux();
  const layoutSelector = createSelector(
    (state: any) => state.Layout,
    state => state.layoutMode,
  );
  const layoutMode = useAppSelector(layoutSelector);

  const onChangeLayoutMode = (
    value: LAYOUT_MODES.LIGHT | LAYOUT_MODES.DARK,
  ) => {
    dispatch(changelayoutMode(value));
  };

  return (
    <div className="accordion-body">
      <div className="mb-4">
        <h5 className="mb-3 font-size-11 text-muted text-uppercase">
          Appearance
        </h5>
        <div
          className="btn-group w-100"
          role="radiogroup"
          aria-label="Color mode"
        >
          <input
            className="btn-check"
            type="radio"
            name="layout-mode"
            id="settings-theme-light"
            checked={layoutMode === LAYOUT_MODES.LIGHT}
            onChange={() => onChangeLayoutMode(LAYOUT_MODES.LIGHT)}
          />
          <label
            className="btn btn-outline-primary"
            htmlFor="settings-theme-light"
          >
            <i className="bx bx-sun me-1" aria-hidden="true"></i>
            Light
          </label>

          <input
            className="btn-check"
            type="radio"
            name="layout-mode"
            id="settings-theme-dark"
            checked={layoutMode === LAYOUT_MODES.DARK}
            onChange={() => onChangeLayoutMode(LAYOUT_MODES.DARK)}
          />
          <label
            className="btn btn-outline-primary"
            htmlFor="settings-theme-dark"
          >
            <i className="bx bx-moon me-1" aria-hidden="true"></i>
            Dark
          </label>
        </div>
      </div>

      <ThemeColor theme={theme} onChangeData={onChangeData} />

      <ThemeImage theme={theme} onChangeData={onChangeData} />
    </div>
  );
};

export default ThemeSettings;
