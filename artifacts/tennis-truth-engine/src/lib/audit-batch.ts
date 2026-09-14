export function normalizeBatchMatchIds(matchIds:unknown,max=100):string[]{
  if(!Array.isArray(matchIds))return[];
  return[...new Set(matchIds.filter((id):id is string=>typeof id==="string"&&id.length>=10))].slice(0,max);
}

export async function mapBounded<T,R>(items:readonly T[],concurrency:number,worker:(item:T,index:number)=>Promise<R>):Promise<R[]>{
  const results=new Array<R>(items.length);
  let next=0;
  const run=async()=>{
    while(next<items.length){
      const index=next++;
      results[index]=await worker(items[index]!,index);
    }
  };
  await Promise.all(Array.from({length:Math.min(items.length,Math.max(1,Math.floor(concurrency)))},run));
  return results;
}

export async function waitForBoundedResult<T>(
  work:Promise<T>,
  maxWaitMs:number,
):Promise<{timedOut:false;value:T}|{timedOut:true}>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  const timeout=new Promise<{timedOut:true}>(resolve=>{
    timer=setTimeout(()=>resolve({timedOut:true}),Math.max(1,Math.floor(maxWaitMs)));
  });
  const completed=work.then(value=>({timedOut:false as const,value}));
  const result=await Promise.race([completed,timeout]);
  if(timer)clearTimeout(timer);
  return result;
}