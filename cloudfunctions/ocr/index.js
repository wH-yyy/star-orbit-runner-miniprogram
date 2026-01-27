const cloud = require('wx-server-sdk')

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 云函数入口函数
exports.main = async function(event, context) {
  // 获取微信上下文
  const wxContext = cloud.getWXContext()
  // 获取传入的参数
  const { fileID } = event
  
  console.log('=== OCR云函数开始执行 ===')
  console.log('请求参数:', { fileID })
  console.log('执行环境:', wxContext.ENV)
  
  // 检查参数
  if (!fileID) {
    console.error('错误: 缺少必要参数fileID')
    return {
      code: 400,
      message: '缺少必要参数fileID',
      requestId: wxContext.OPENID,
      timestamp: Date.now()
    }
  }
  
  try {
    // 调用微信云开发OCR API
    console.log('开始调用微信云开发OCR API...')
    const ocrResult = await cloud.openapi.ocr.recognizeGeneralText({
      type: 'file',
      media: {
        fileID: fileID
      }
    })
    
    console.log('OCR API调用成功')
    console.log('OCR API返回结果:', JSON.stringify(ocrResult, null, 2))
    
    // 提取识别到的文本
    let ocrText = ''
    if (ocrResult.words_result && ocrResult.words_result.length > 0) {
      ocrText = ocrResult.words_result.map(item => item.words).join('\n')
      console.log('提取到的OCR文本:', ocrText)
    } else {
      console.warn('OCR API未识别到任何文本')
    }
    
    // 返回成功结果
    return {
      code: 200,
      message: 'OCR识别成功',
      data: {
        ocrText: ocrText,
        rawText: ocrText,
        fullResult: ocrResult,
        wordCount: ocrResult.words_result ? ocrResult.words_result.length : 0,
        fileID: fileID
      },
      requestId: wxContext.OPENID,
      timestamp: Date.now()
    }
  } catch (error) {
    console.error('OCR识别失败，详细错误信息:', error)
    
    // 错误分类处理
    let errorCode = error.errCode || 500
    let errorMessage = 'OCR识别失败'
    
    // 根据错误码返回具体的错误信息
    switch (errorCode) {
      case -501003:
        errorMessage = '图片格式不支持，请上传JPG、PNG或BMP格式的图片'
        break
      case -501004:
        errorMessage = '图片大小超过限制，请上传小于2MB的图片'
        break
      case -501005:
        errorMessage = '图片下载失败，请检查图片URL或权限'
        break
      case -501006:
        errorMessage = 'OCR服务不可用，请稍后重试'
        break
      default:
        errorMessage = `OCR识别失败: ${error.message}`
    }
    
    // 返回错误结果
    return {
      code: errorCode,
      message: errorMessage,
      error: {
        message: error.message,
        errCode: error.errCode,
        stack: error.stack
      },
      requestId: wxContext.OPENID,
      timestamp: Date.now()
    }
  } finally {
    console.log('=== OCR云函数执行结束 ===')
  }
}
