import { Navigate, Route, Routes } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";
import { Home } from "./routes/Home";
import { Landing } from "./routes/Landing";
import { Session } from "./routes/Session";

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <SignedIn>
              <Home />
            </SignedIn>
            <SignedOut>
              <Landing />
            </SignedOut>
          </>
        }
      />
      <Route
        path="/s/:code"
        element={
          <>
            <SignedIn>
              <Session />
            </SignedIn>
            <SignedOut>
              <Landing />
            </SignedOut>
          </>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
