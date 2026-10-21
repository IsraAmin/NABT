import {useEffect,useRef} from 'react';

type Player={
 getCurrentTime:()=>number; getDuration:()=>number;getPlayerState:()=>number;
 seekTo:(second:number,allowSeekAhead:boolean)=>void;
 destroy:()=>void;
};
type YTWindow=Window & {YT?:{Player:new(el:HTMLElement,opts:Record<string,unknown>)=>Player},onYouTubeIframeAPIReady?:()=>void};
let loading:Promise<void>|null=null;
function loadYouTube(){
 if(loading)return loading;
 loading=new Promise<void>((resolve,reject)=>{
  const w=window as YTWindow;
  if(w.YT?.Player){resolve();return;}
  const previous=w.onYouTubeIframeAPIReady;
  w.onYouTubeIframeAPIReady=()=>{previous?.();resolve();};
  const script=document.createElement('script');
  script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>{loading=null;reject(new Error('تعذر تحميل مشغل يوتيوب'));};
  document.head.appendChild(script);
 });
 return loading;
}
type Props={
 videoId:string;startSeconds:number;onCheckpoint:(position:number,duration:number,watchedDelta:number)=>void;
 onError:(message:string)=>void;
};
export default function TrackedYouTubePlayer({videoId,startSeconds,onCheckpoint,onError}:Props){
 const el=useRef<HTMLDivElement|null>(null);
 const onCheckpointRef=useRef(onCheckpoint);const onErrorRef=useRef(onError);
 useEffect(()=>{onCheckpointRef.current=onCheckpoint;onErrorRef.current=onError;},[onCheckpoint,onError]);
 useEffect(()=>{
  let disposed=false,player:Player|null=null,interval:number|undefined;
  let lastPosition=0, watchedDelta=0, checkpointAt=Date.now();
  const checkpoint=()=>{
   if(!player)return;
   try{
    const position=Math.max(0,Math.floor(player.getCurrentTime()||0));
    const duration=Math.max(0,Math.floor(player.getDuration()||0));
    if(position||duration||watchedDelta)onCheckpointRef.current(position,duration,watchedDelta);
    watchedDelta=0;checkpointAt=Date.now();
   }catch{/* player may be closing */}
  };
  void loadYouTube().then(()=>{
   if(disposed||!el.current)return;
   const w=window as YTWindow;
   player=new w.YT!.Player(el.current,{
    videoId,
    playerVars:{rel:0,playsinline:1,origin:window.location.origin},
    events:{
     onReady:()=>{
      if(!player||disposed)return;
      if(startSeconds>0)player.seekTo(startSeconds,true);
      lastPosition=startSeconds;
      interval=window.setInterval(()=>{
       if(!player||disposed)return;
       try{
        const current=player.getCurrentTime()||0;
        if(player.getPlayerState()===1){
         const delta=current-lastPosition;
         if(delta>0&&delta<=6)watchedDelta+=Math.round(delta);
        }
        lastPosition=current;
        if(Date.now()-checkpointAt>=7000)checkpoint();
       }catch{/* playback may have stopped */}
      },1000);
     },
     onStateChange:(event:{data:number})=>{if(event.data===2||event.data===0)checkpoint();},
     onError:()=>onErrorRef.current('هذا الفيديو لا يسمح بالتشغيل داخل المنصة. يمكنك فتحه على يوتيوب.')
    }
   });
  }).catch(()=>{if(!disposed)onErrorRef.current('تعذر تحميل مشغل يوتيوب. استخدمي فتح الفيديو على يوتيوب.');});
  return ()=>{
   disposed=true;
   if(interval!==undefined)window.clearInterval(interval);
   checkpoint();
   try{player?.destroy();}catch{/* iframe already removed */}
  };
 },[videoId]);
 return <div className="resources-watch-player"><div ref={el} className="resources-player-target"/></div>;
}
