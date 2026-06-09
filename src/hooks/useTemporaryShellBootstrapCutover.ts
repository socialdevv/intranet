import { useData, type ShellCutover } from "@/contexts/data-context";

export type TemporaryShellBootstrapCutover = ShellCutover;

export function useTemporaryShellBootstrapCutover(
  _pathname: string
): TemporaryShellBootstrapCutover {
  const { shellCutover } = useData();
  return shellCutover;
}