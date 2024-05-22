const queryBuilder = (request)=> {
    if(!request.query) return;
    const filterParams = request?.query?.filter;
    const sortParams = request?.query?.sort;
    const filter = Object?.keys(filterParams || {})?.reduce((prev, value) => ({ ...prev, [value]: new RegExp(filterParams[value])}), {});
    const sort = sortParams;
   return {
    filter,
    sort,
   }
  }

export {queryBuilder}