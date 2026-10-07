export const PAGE_SIZE = 50;

export function parsePage(searchParams?: { page?: string }) {
  const page = Number(searchParams?.page);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function pageSkipTake(page: number, pageSize: number = PAGE_SIZE) {
  return { skip: (page - 1) * pageSize, take: pageSize + 1 };
}

/** Busca-se sempre pageSize+1 linhas; a linha extra só serve para saber se existe próxima página. */
export function splitPage<T>(rows: T[], pageSize: number = PAGE_SIZE) {
  const hasNext = rows.length > pageSize;
  return { rows: hasNext ? rows.slice(0, pageSize) : rows, hasNext };
}
