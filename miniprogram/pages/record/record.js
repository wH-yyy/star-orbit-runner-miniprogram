// pages/record/record.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    // 用户信息
    userInfo: {
      stu_id: '',
      name: '',
      avatar: ''
    },
    // 跑步记录列表
    recordList: [],
    // 统计数据
    totalCount: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalDistanceKm: '0.00',
    totalDurationMinutes: '0',
    // 加载状态
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadUserInfo()
    this.loadRecords()
  },

  /**
   * 加载用户信息
   */
  async loadUserInfo() {
    try {
      const app = getApp()
      const stuId = app.globalData.userInfo?.stu_id || wx.getStorageSync('stu_id')
      
      console.log('=== record.js loadUserInfo ===')
      console.log('全局userInfo:', app.globalData.userInfo)
      console.log('本地存储stu_id:', wx.getStorageSync('stu_id'))
      console.log('获取到的stuId:', stuId)
      
      if (!stuId) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        })
        setTimeout(() => {
          wx.redirectTo({
            url: '/pages/login/login'
          })
        }, 1500)
        return
      }
      
      // 从数据库获取用户完整信息
      const db = wx.cloud.database()
      const res = await db.collection('Users')
        .where({
          stu_id: stuId
        })
        .get()
      
      console.log('数据库查询结果:', res)
      
      if (res.data.length > 0) {
        const userData = res.data[0]
        const totalDist = userData.totalDistance || 0
        const totalDur = userData.totalDuration || 0
        
        console.log('用户数据:', userData)
        console.log('设置userInfo为:', {
          stu_id: userData.stu_id,
          name: userData.name,
          avatar: userData.avatar || '/images/default-avatar.png'
        })
        
        this.setData({
          userInfo: {
            stu_id: userData.stu_id,
            name: userData.name,
            avatar: userData.avatar || '/images/default-avatar.png'
          },
          totalCount: userData.totalCount || 0,
          totalDistance: totalDist,
          totalDuration: totalDur,
          totalDistanceKm: (totalDist / 1000).toFixed(2),
          totalDurationMinutes: Math.round(totalDur / 60).toString()
        })
        
        console.log('设置后的data:', this.data)
      } else {
        console.error('未找到用户数据，stuId:', stuId)
      }
    } catch (error) {
      console.error('加载用户信息失败:', error)
    }
  },

  /**
   * 加载跑步记录
   */
  async loadRecords() {
    try {
      this.setData({ loading: true })
      
      const app = getApp()
      const stuId = app.globalData.userInfo?.stu_id || wx.getStorageSync('stu_id')
      
      if (!stuId) {
        return
      }
      
      // 从数据库获取跑步记录
      const db = wx.cloud.database()
      const res = await db.collection('RunningRecords')
        .where({
          stu_id: stuId
        })
        .orderBy('createTime', 'desc')
        .get()
      
      this.setData({
        recordList: res.data,
        loading: false
      })
      
    } catch (error) {
      console.error('加载跑步记录失败:', error)
      this.setData({ loading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 每次显示页面时重新加载数据（防止从提交页面返回后数据不更新）
    this.loadUserInfo()
    this.loadRecords()
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    // 下拉刷新数据
    this.loadUserInfo()
    this.loadRecords()
    wx.stopPullDownRefresh()
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  }
})