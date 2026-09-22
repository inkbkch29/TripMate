import { describe, expect, it, vi } from "vitest";
import { drawSquareCrop } from "./image-utils";

describe("profile image crop",()=>{
  it("rotates a landscape image and keeps the crop fully covered",()=>{
    const context={save:vi.fn(),clearRect:vi.fn(),fillRect:vi.fn(),translate:vi.fn(),rotate:vi.fn(),drawImage:vi.fn(),restore:vi.fn(),set fillStyle(value){this._fillStyle=value;},set imageSmoothingEnabled(value){this._smooth=value;},set imageSmoothingQuality(value){this._quality=value;}};
    const image={naturalWidth:800,naturalHeight:400};
    drawSquareCrop(context,image,512,{rotation:90,zoom:1,offsetX:0,offsetY:0});
    expect(context.rotate).toHaveBeenCalledWith(Math.PI/2);
    expect(context.drawImage).toHaveBeenCalledWith(image,-512,-256,1024,512);
    expect(context._quality).toBe("high");
  });

  it("applies zoom and crop position",()=>{
    const context={save:vi.fn(),clearRect:vi.fn(),fillRect:vi.fn(),translate:vi.fn(),rotate:vi.fn(),drawImage:vi.fn(),restore:vi.fn(),set fillStyle(value){},set imageSmoothingEnabled(value){},set imageSmoothingQuality(value){}};
    drawSquareCrop(context,{naturalWidth:1000,naturalHeight:1000},500,{zoom:2,offsetX:100,offsetY:-100});
    expect(context.translate).toHaveBeenCalledWith(500,0);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(),-500,-500,1000,1000);
  });
});
