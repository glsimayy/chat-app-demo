import React, { useEffect } from "react";

// hooks
import { useRedux } from "../../../hooks/index";
import { createSelector } from "reselect";
// components
import Loader from "../../../components/Loader";
import AppSimpleBar from "../../../components/AppSimpleBar";
import LeftbarTitle from "../../../components/LeftbarTitle";
import Call from "./Call";

// actions
import { getCalls } from "../../../redux/actions";

// interface
import { CallItem } from "../../../data/calls";

interface IndexProps {}
const Index = (props: IndexProps) => {
  // global store
  const { dispatch, useAppSelector } = useRedux();

  const errorData = createSelector(
    (state : any) => state.Calls,
    (state) => ({
      calls: state.calls,
      getCallsLoading: state.getCallsLoading,
      error: state.error,
    })
  );
  const { calls, getCallsLoading, error } = useAppSelector(errorData);

  useEffect(() => {
    dispatch(getCalls());
    const refreshCalls = () => dispatch(getCalls());
    window.addEventListener("ello:calls-updated", refreshCalls);

    return () => {
      window.removeEventListener("ello:calls-updated", refreshCalls);
    };
  }, [dispatch]);

  return (
    <div className="position-relative">
      {getCallsLoading && <Loader />}
      <LeftbarTitle title="Calls" />
      {/* end p-4 */}

      {/* Start contact lists */}
      <AppSimpleBar className="chat-message-list chat-call-list">
        {!getCallsLoading && error && (
          <div className="call-empty-state text-danger">
            <i className="bx bx-error-circle" aria-hidden="true"></i>
            <strong>Call history could not load</strong>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => dispatch(getCalls())}
            >
              Retry
            </button>
          </div>
        )}
        {!getCallsLoading && !error && (calls || []).length === 0 && (
          <div className="call-empty-state">
            <i className="bx bx-phone" aria-hidden="true"></i>
            <strong>No calls yet</strong>
            <span>Your incoming and outgoing audio calls will appear here.</span>
          </div>
        )}
        <ul className="list-unstyled chat-list">
          {(calls || []).map((call: CallItem) => (
            <Call call={call} key={call.callId} />
          ))}
        </ul>
      </AppSimpleBar>
      {/* end contact lists */}
    </div>
  );
};

export default Index;
