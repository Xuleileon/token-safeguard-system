export const generateAuthUrl = (appId: string) => {
  const redirectUri = `${window.location.origin}/auth/callback`;
  return `https://qianchuan.jinritemai.com/openapi/qc/audit/oauth.html?app_id=${appId}&state=your_custom_params&material_auth=1&rid=vustzvbhrmo`;
};