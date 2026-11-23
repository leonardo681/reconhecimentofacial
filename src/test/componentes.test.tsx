import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import NotFound from "@/pages/NotFound";
import { RootErrorBoundary } from "@/components/RootErrorBoundary";
import QuickRegister from "@/components/QuickRegister";

vi.mock("@/lib/images", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/images")>();
  return {
    ...original,
    fileToCanvas: vi.fn(async () => document.createElement("canvas")),
    canvasToDataUrl: vi.fn(() => "data:image/jpeg;base64,AAAA"),
  };
});

describe("NotFound", () => {
  it("mostra a página 404 em português", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <MemoryRouter initialEntries={["/nao-existe"]}>
        <NotFound />
      </MemoryRouter>,
    );
    expect(screen.getByText("Página não encontrada")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar ao início" })).toBeInTheDocument();
  });
});

describe("RootErrorBoundary", () => {
  it("mostra uma saída amigável e 'Tentar de novo' remonta o app", () => {
    let explode = true;
    const Bomba = () => {
      if (explode) throw new Error("boom");
      return <p>tudo certo</p>;
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // O erro é proposital: evita que o jsdom o imprima como "Uncaught".
    const silenciar = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener("error", silenciar);
    try {
      render(
        <RootErrorBoundary>
          <Bomba />
        </RootErrorBoundary>,
      );
      expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Recarregar página" })).toBeInTheDocument();
      explode = false;
      fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
      expect(screen.getByText("tudo certo")).toBeInTheDocument();
    } finally {
      window.removeEventListener("error", silenciar);
      spy.mockRestore();
    }
  });
});

describe("QuickRegister", () => {
  const renderForm = (onRegister = vi.fn(async () => {})) =>
    render(
      <QuickRegister faceImage="data:image/jpeg;base64,AA" faceNumber={2} onRegister={onRegister} onCancel={vi.fn()} />,
    );

  it("adiciona as fotos mesmo quando limpar o campo esvazia o FileList (como no Chrome e no Safari)", async () => {
    renderForm();
    const input = screen.getByLabelText("Adicionar fotos extras") as HTMLInputElement;
    const file = new File(["x"], "alan.jpg", { type: "image/jpeg" });
    // FileList "vivo": o navegador esvazia o MESMO objeto quando o valor do campo é limpo.
    const liveList: { length: number; [index: number]: File | undefined; item: (i: number) => File | null } = {
      0: file,
      length: 1,
      item: (i: number) => (i === 0 && liveList.length ? file : null),
    };
    Object.defineProperty(input, "files", { configurable: true, get: () => liveList });
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => "",
      set: () => {
        liveList.length = 0;
        delete liveList[0];
      },
    });
    fireEvent.change(input);
    expect(await screen.findByAltText("Foto adicional 1")).toBeInTheDocument();
  });

  it("envia uma vez só, mostra o progresso e exibe o erro se o cadastro falhar", async () => {
    let fail: (error: Error) => void = () => {};
    const onRegister = vi.fn(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    renderForm(onRegister);
    fireEvent.change(screen.getByPlaceholderText("Digite o nome..."), { target: { value: "Fulano de Tal" } });
    const submit = screen.getByRole("button", { name: /Cadastrar/ });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onRegister.mock.calls[0]).toEqual([
      { name: "Fulano de Tal", notes: "", bodyMarks: [], additionalPhotos: [] },
    ]);
    expect(screen.getByRole("button", { name: /Cadastrando/ })).toBeDisabled();
    await act(async () => {
      fail(new Error("Falha simulada no cadastro"));
    });
    expect(await screen.findByText("Falha simulada no cadastro")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cadastrar/ })).toBeEnabled();
  });

  it("associa os rótulos aos campos (acessibilidade)", () => {
    renderForm();
    expect(screen.getByLabelText("Nome Completo *")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo")).toBeInTheDocument();
    expect(screen.getByLabelText("Observações gerais")).toBeInTheDocument();
  });
});
