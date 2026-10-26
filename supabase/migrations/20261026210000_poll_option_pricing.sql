begin;
-- Nullable metadata preserves legacy prices without assuming a unit or rewriting options.
alter table public.stay_poll_options add column price_type text,add column price_min numeric(12,2),add column price_max numeric(12,2),add column price_unit text,
 add constraint poll_option_price_shape check (
 (price_type is null and price_min is null and price_max is null and price_unit is null) or
 (price_type is not null and price_unit in ('person','total') and price_unit is not null and (
 (price_type='none' and price_min is null and price_max is null and price is null) or
 (price_type='fixed' and price_min is not null and price_min>=0 and price_max is null and price is not null and price=price_min) or
 (price_type='range' and price_min is not null and price_max is not null and price_min>=0 and price_max>=price_min and price is null))));
create function public.trip_poll_price_input(data jsonb,previous public.stay_poll_options) returns jsonb language plpgsql immutable set search_path=public as $$
declare kind text:=data->>'priceType';unit text:=coalesce(data->>'priceUnit','person');lo numeric;hi numeric;legacy numeric;
begin
 if kind is null then
  legacy:=case when data?'price' then nullif(data->>'price','')::numeric else previous.price end;
  if previous.price_type is not null and legacy is distinct from previous.price then raise exception 'ใช้รูปแบบราคาใหม่เมื่อแก้ราคา';end if;
  return jsonb_build_object('price',legacy,'priceType',previous.price_type,'priceMin',previous.price_min,'priceMax',previous.price_max,'priceUnit',previous.price_unit);
 end if;
 if kind not in ('none','fixed','range') or unit not in ('person','total') then raise exception 'เลือกรูปแบบและหน่วยราคา';end if;
 if kind<>'none' then
  lo:=nullif(data->>'priceMin','')::numeric;
  if lo is null or lo<0 or lo>9999999999.99 or lo<>round(lo,2) or lo::text in ('NaN','Infinity','-Infinity') then raise exception 'กรอกราคาไม่ติดลบและทศนิยมไม่เกิน 2 ตำแหน่ง';end if;
  if kind='range' then
   hi:=nullif(data->>'priceMax','')::numeric;
   if hi is null or hi<lo or hi>9999999999.99 or hi<>round(hi,2) or hi::text in ('NaN','Infinity','-Infinity') then raise exception 'ราคาสูงสุดต้องไม่น้อยกว่าราคาต่ำสุด และทศนิยมไม่เกิน 2 ตำแหน่ง';end if;
  end if;
 end if;
 return jsonb_build_object('price',case when kind='fixed' then lo else null end,'priceType',kind,'priceMin',lo,'priceMax',hi,'priceUnit',unit);
end $$;
revoke all on function public.trip_poll_price_input(jsonb,public.stay_poll_options) from public,anon,authenticated;
-- Keep existing permissions, revision locks, vote protection, images and links validation.
do $$declare definition text;old_text text;new_text text;begin
 definition:=pg_get_functiondef('public.trip_poll_option_save(uuid,jsonb,boolean)'::regprocedure);
 if position('pr numeric;legacy text;' in definition)=0 or position('name=nm,details=d,price=pr,images=imgs' in definition)=0 then raise exception 'Unexpected option save definition';end if;
 definition:=replace(definition,'pr numeric;legacy text;','pr numeric;legacy text;pricing jsonb;');
 definition:=replace(definition,'pr:=nullif(option_data->>''price'','''')::numeric;','pricing:=public.trip_poll_price_input(option_data,o);pr:=(pricing->>''price'')::numeric;');
 old_text:='o.price is distinct from pr or o.images';
 new_text:='o.price is distinct from pr or o.price_type is distinct from pricing->>''priceType'' or o.price_min is distinct from (pricing->>''priceMin'')::numeric or o.price_max is distinct from (pricing->>''priceMax'')::numeric or o.price_unit is distinct from pricing->>''priceUnit'' or o.images';
 if position(old_text in definition)=0 then raise exception 'Unexpected vote protection';end if;
 definition:=replace(definition,old_text,new_text);
 definition:=replace(definition,'name=nm,details=d,price=pr,images=imgs','name=nm,details=d,price=pr,price_type=pricing->>''priceType'',price_min=(pricing->>''priceMin'')::numeric,price_max=(pricing->>''priceMax'')::numeric,price_unit=pricing->>''priceUnit'',images=imgs');
 definition:=replace(definition,'(poll_id,name,details,price,images,links,created_by,sort_order) values(p.id,nm,d,pr,imgs,lnks,auth.uid(),','(poll_id,name,details,price,price_type,price_min,price_max,price_unit,images,links,created_by,sort_order) values(p.id,nm,d,pr,pricing->>''priceType'',(pricing->>''priceMin'')::numeric,(pricing->>''priceMax'')::numeric,pricing->>''priceUnit'',imgs,lnks,auth.uid(),');
 if position('pricing:=public.trip_poll_price_input(option_data,o)' in definition)=0 or position('price_unit,images,links,created_by' in definition)=0 then raise exception 'Incomplete pricing patch';end if;
 execute definition;
 definition:=pg_get_functiondef('public.trip_poll_snapshot_base(uuid,integer)'::regprocedure);
 if position('''price'',o.price,' in definition)=0 then raise exception 'Unexpected snapshot definition';end if;
 execute replace(definition,'''price'',o.price,','''price'',o.price,''priceType'',o.price_type,''priceMin'',o.price_min,''priceMax'',o.price_max,''priceUnit'',o.price_unit,');
end $$;
commit;
