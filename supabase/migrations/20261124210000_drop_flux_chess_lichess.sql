-- Flux Chess moved out of Flux into its own project; its table goes too.
drop trigger if exists flux_chess_lichess_before_write on public.flux_chess_lichess;
drop table if exists public.flux_chess_lichess;
drop function if exists public.flux_chess_lichess_before_write();
