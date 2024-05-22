import { Request } from "express";

const queryBuilder = (request: Request)=> {
    if(!request.query) return {};
    const filterParams: Record<string, string> = Object(request?.query?.filter || "") || {} ;
    const sortParams = request?.query?.sort;
    const filter = Object?.keys(filterParams)?.reduce((prev, value: string) => ({ ...prev, [value]: new RegExp(filterParams[value])}), {}) || {};
    const sort = sortParams;
   return {
    filter,
    sort: String(sort),
   }
  }

export {queryBuilder}