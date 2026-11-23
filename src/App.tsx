import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";

const routerBasename =
  import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

const App = () => (
  <>
    <Toaster theme="dark" position="top-center" richColors closeButton />
    <BrowserRouter basename={routerBasename}>
      <Routes>
        <Route path="/" element={<Index />} />
        {/* Quem abre /reconhecimentofacial/index.html cai na tela principal, não na 404. */}
        <Route path="/index.html" element={<Navigate to="/" replace />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </>
);

export default App;
