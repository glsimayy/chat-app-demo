import React from "react";
import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { configureStore } from "./redux/store";

test("renders the login route", async () => {
  render(
    <Provider store={configureStore({})}>
      <MemoryRouter initialEntries={["/auth-login"]}>
        <App />
      </MemoryRouter>
    </Provider>,
  );

  expect(
    await screen.findByText("Sign in to continue to ellO."),
  ).toBeInTheDocument();
});
