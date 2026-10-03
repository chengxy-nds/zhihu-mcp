import fs from "node:fs";
import path from "node:path";

// Embedded default cookie provided by the user for immediate zero-config operation
export const DEFAULT_ZHIHU_COOKIE =
  "_xsrf=XDyJr3uebZFmTK5MF2KDKM6JcqCqyMiv; _zap=700963f3-facb-4a02-b9fb-b88f25d23850; d_c0=4GNU29eP5xuPTvj2CI4qT-V6LG7yYVBbi1M=|1772176323; edu_user_uuid=edu-v1|f983134f-513f-44e3-8547-4c6dabea7fb5; z_c0=2|1:0|10:1789130490|4:z_c0|92:Mi4xUGppa0lBQUFBQURnWTFUYjE0X25HeVlBQUFCZ0FsVk4ta1NSYXdDZ2E3X3MwR3k4RmI4Q2JkOHRXUVVLbmszeUtR|9505e5b42c4faec873a08409ceb963d080afda163010a1aa8c797b462c98cca0; Hm_lvt_98beee57fd2ef70ccdd5ca52b9740c49=1789736738,1790696583; HMACCOUNT=57E1290AE5ED8572; __zse_ck=005_qtd3fUBzYV9QE1VyYPlwYCAha4Q0dnH4AfbTZQazCNhDDH0OEI15vlMExbmcJH8FvTsviufmaXj1Q7I0CtUm6Vay6e1Lf1AR4mFy=81kg8VXcEWkSORDR785dhbOCnWz-KGUFBQdXJvcED8jcm89SfPB2BJgJuLbe58uo73YJt02FxkfqcbQUBeVwHjJSUvBGnRbP2EHfs6bUwKNkzDY4yVYAdKHlMpSZ6vZm83KePsbHJF/E/5BV7YzKfGPFOS59; BEC=6bca8f185b99e85d761c7a0d8d692864; Hm_lpvt_98beee57fd2ef70ccdd5ca52b9740c49=1790786918";

export const DEFAULT_USER_SLUG = "xiaofucode";

/**
 * Resolves the cookie using priorities:
 * 1. Explicitly passed cookie
 * 2. ZHIHU_COOKIE environment variable
 * 3. .cookie file in project root
 * 4. Embedded default fallback
 */
export function resolveCookie(explicitCookie?: string): string {
  if (explicitCookie && explicitCookie.trim()) {
    return explicitCookie.trim();
  }

  if (process.env.ZHIHU_COOKIE && process.env.ZHIHU_COOKIE.trim()) {
    return process.env.ZHIHU_COOKIE.trim();
  }

  const cookieFilePath = path.resolve(process.cwd(), ".cookie");
  if (fs.existsSync(cookieFilePath)) {
    try {
      const content = fs.readFileSync(cookieFilePath, "utf-8").trim();
      if (content) return content;
    } catch {
      // ignore
    }
  }

  return DEFAULT_ZHIHU_COOKIE;
}
