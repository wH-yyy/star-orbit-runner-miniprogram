// pages/appeal-history/appeal-history.js
Page({
  data: {
    appealList: [],
    loading: true,
  },

  onLoad() {
    this.loadAppealHistory()
  },

  onShow() {
    this.setData({
      appealList: [],
      loading: true,
    })
    this.loadAppealHistory()
  },

  onPullDownRefresh() {
    this.setData({
      appealList: [],
      loading: true,
    })
    this.loadAppealHistory()
    wx.stopPullDownRefresh()
  },

  loadAppealHistory() {
    this.setData({ loading: true })
  
    const app = getApp()
    const openid = app.globalData.userInfo.openid
    const db = wx.cloud.database()
  
    db.collection('Appeals')
      .where({ openid })
      .orderBy('createTime', 'desc')
      .get()
      .then(res => {
        const appealData = res.data
        
        const processedAppeals = appealData.map(item => {
          let statusText = '正在申诉中'
          let statusClass = 'status-pending'
          if (item.status === 1) {
            statusText = '申诉被接受'
            statusClass = 'status-success'
          } else if (item.status === 2) {
            statusText = '申诉被驳回'
            statusClass = 'status-failed'
          }
  
          let createDate = ''
          let createTime = ''
          if (item.createTime) {
            const date = new Date(item.createTime)
            
            // 日期：YYYY-MM-DD
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            createDate = `${year}-${month}-${day}`
            
            // 时间：HH:mm:ss
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            const seconds = String(date.getSeconds()).padStart(2, '0')
            createTime = `${hours}:${minutes}:${seconds}`
          }
  
          return {
            ...item,
            statusText,
            statusClass,
            createDate,
            createTime
          }
        })
        
        this.setData({
          appealList: processedAppeals,
          loading: false
        })
      })
      .catch(error => {
        console.error('加载申诉历史失败:', error)
        this.setData({ loading: false })
        wx.showToast({ title: '加载申诉历史失败', icon: 'none' })
      })
  },

  viewRecordDetail(e) {
    const index = e.currentTarget.dataset.index
    const recordId = this.data.appealList[index].runningRecordId
    wx.navigateTo({
      url: `/pages/record-detail/record-detail?recordId=${recordId}`
    })
  },
})
