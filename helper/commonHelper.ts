import { Request } from "express";

const queryBuilder = (request: Request)=> {
    if(!request.query) return {};
    const filterParams: Record<string, string> = Object(request?.query?.filter || "") || {} ;
    const expandParams: Record<string, string> = Object(request?.query?.expand || "") || {} ;
    const sortParams = request?.query?.sort;
    const page = Number(request?.query?.page || 1);
    const perPage = Number(request?.query?.per_page || 99);
    const filter = Object?.keys(filterParams)?.reduce((prev, value: string) => ({ ...prev, [value]: new RegExp(filterParams[value])}), {}) || {};
    const sort = sortParams;
   return {
    filter,
    sort: String(sort),
    expand: expandParams,
    page,
    perPage,
   }
  }

export {queryBuilder}