import React, { useEffect, useState } from "react";
import classnames from "classnames";

// interface
import { ThemeTypes } from "../../../data/settings";

const changeImage = (id: string) => {
  const element = document.getElementById(`image-${id}`);
  if (element) {
    const image = window
      .getComputedStyle(element, null)
      .getPropertyValue("background-image");
    const userChat = document.getElementById("user-chat");
    if (userChat) {
      userChat.style.backgroundImage = image;
    }
  }
};

interface ThemeImageTypes {
  id: string;
  pattern: string;
  name: string;
}

interface FormCheckProps {
  image: ThemeImageTypes;
  selected: ThemeImageTypes | null;
  onChange: (image: ThemeImageTypes) => void;
}
const FormCheck = ({ image, selected, onChange }: FormCheckProps) => {
  const checked = selected?.id === image.id;

  return (
    <div className="theme-pattern-item">
      <input
        className="theme-pattern-input"
        type="radio"
        name="bgimg-radio"
        id={image.id}
        aria-label={image.name}
        onChange={() => onChange(image)}
        checked={checked}
      />
      <label className="theme-pattern-option" htmlFor={image.id}>
        <span className="theme-pattern-card">
          <span
            className={classnames("theme-pattern-preview", image.pattern)}
            id={`image-${image.id}`}
            aria-hidden="true"
          ></span>
          <span className="theme-pattern-name">{image.name}</span>
        </span>
        <span className="theme-pattern-check" aria-hidden="true">
          <i className="bx bx-check"></i>
        </span>
      </label>
    </div>
  );
};

interface ThemeImageProps {
  theme: ThemeTypes;
  onChangeData: (field: string, value: any) => void;
}

const themeImages: ThemeImageTypes[] = [
  {
    id: "bgimg-radio1",
    pattern: "bg-pattern-1",
    name: "Pattern 1",
  },
  {
    id: "bgimg-radio2",
    pattern: "bg-pattern-2",
    name: "Pattern 2",
  },
  {
    id: "bgimg-radio3",
    pattern: "bg-pattern-3",
    name: "Pattern 3",
  },
  {
    id: "bgimg-radio4",
    pattern: "bg-pattern-4",
    name: "Pattern 4",
  },
  {
    id: "bgimg-radio5",
    pattern: "bg-pattern-5",
    name: "Pattern 5",
  },
  {
    id: "bgimg-radio6",
    pattern: "bg-pattern-6",
    name: "Pattern 6",
  },
  {
    id: "bgimg-radio7",
    pattern: "bg-pattern-7",
    name: "Pattern 7",
  },
  {
    id: "bgimg-radio8",
    pattern: "bg-pattern-8",
    name: "Pattern 8",
  },
  {
    id: "bgimg-radio9",
    pattern: "bg-pattern-9",
    name: "Pattern 9",
  },
];

const ThemeImage = ({ theme, onChangeData }: ThemeImageProps) => {
  const [selected, setSelected] = useState<ThemeImageTypes | null>(null);

  const onChangeThemeImage = (image: ThemeImageTypes) => {
    setSelected(image);
    onChangeData("theme", { ...theme, image: image.id });
  };

  useEffect(() => {
    if (theme && theme.image) {
      const userTheme = themeImages.find(
        (image: ThemeImageTypes) => image.id === theme.image,
      );
      if (userTheme) {
        setSelected(userTheme);
      }
    }
  }, [theme]);

  useEffect(() => {
    if (selected !== null) {
      changeImage(selected.id);
    }
  }, [selected]);

  return (
    <div className="mt-4 pt-2">
      <h5
        className="mb-3 font-size-11 text-muted text-uppercase"
        id="chat-background-heading"
      >
        Chat Background
      </h5>
      <div
        className="theme-pattern-grid"
        role="radiogroup"
        aria-labelledby="chat-background-heading"
      >
        {themeImages.map((image: ThemeImageTypes) => (
          <FormCheck
            image={image}
            key={image.id}
            selected={selected}
            onChange={onChangeThemeImage}
          />
        ))}
      </div>
    </div>
  );
};

export default ThemeImage;
